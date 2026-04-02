import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Derivative {
  format: string;
  content: string;
  platform: string;
  char_count: number;
  status: "pending" | "approved" | "rejected";
  previous_drafts: string[];
  created_at: string;
  updated_at: string;
}

// Maps derivative format keys to the platform_name DB enum value
const DERIVATIVE_PLATFORM_MAP: Record<string, string> = {
  linkedin_post: "linkedin",
  instagram_caption: "instagram",
  instagram_carousel: "instagram",
  newsletter_blurb: "other",
  tiktok_script: "tiktok",
  podcast_show_notes: "podcast",
  podcast_script: "podcast",
  patreon_post: "patreon",
};

// Human-readable labels for each derivative format (used as content_item title)
const DERIVATIVE_FORMAT_LABELS: Record<string, string> = {
  linkedin_post: "LinkedIn Post",
  instagram_caption: "Instagram Caption",
  instagram_carousel: "Instagram Carousel",
  newsletter_blurb: "Newsletter Blurb",
  tiktok_script: "TikTok Script",
  podcast_show_notes: "Podcast Show Notes",
  podcast_script: "Podcast Script",
  patreon_post: "Patreon Post",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthenticatedCreator(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  return creator;
}

// ─── GET /api/repurpose/derivatives?job_id=UUID ──────────────────────────────

/**
 * Fetches the derivatives for a repurpose job.
 */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const creator = await getAuthenticatedCreator(supabase);

  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job, error } = await supabase
    .from("repurpose_jobs")
    .select(
      "id, status, derivatives, selected_formats, source_transcript, source_item_id, created_at, updated_at"
    )
    .eq("id", jobId)
    .eq("creator_id", creator.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Fetch content item title for display
  const { data: contentItem } = await supabase
    .from("content_items")
    .select("id, title, platform, body")
    .eq("id", job.source_item_id)
    .single();

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    derivatives: job.derivatives ?? [],
    selected_formats: job.selected_formats ?? [],
    source_transcript: job.source_transcript ?? "",
    content_item: contentItem
      ? {
          id: contentItem.id,
          title: contentItem.title,
          platform: contentItem.platform,
          body: contentItem.body,
        }
      : null,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}

// ─── PUT /api/repurpose/derivatives ──────────────────────────────────────────

/**
 * Updates a single derivative's content (inline edit) or status (approve/reject).
 *
 * Request body:
 *   {
 *     job_id: string,
 *     format_key: string,
 *     action: "update_content" | "approve" | "reject",
 *     content?: string  (required for "update_content")
 *   }
 */
export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, format_key, action, content } = body as {
    job_id?: string;
    format_key?: string;
    action?: string;
    content?: string;
  };

  if (!job_id || !format_key || !action) {
    return NextResponse.json(
      { error: "Missing job_id, format_key, or action" },
      { status: 400 }
    );
  }

  if (!["update_content", "approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "update_content" && (content === undefined || content === null)) {
    return NextResponse.json(
      { error: "content is required for update_content action" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const creator = await getAuthenticatedCreator(supabase);

  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("repurpose_jobs")
    .select("id, derivatives, source_item_id")
    .eq("id", job_id)
    .eq("creator_id", creator.id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const derivatives = (job.derivatives ?? []) as Derivative[];
  const now = new Date().toISOString();
  let found = false;

  const updatedDerivatives = derivatives.map((d) => {
    if (d.format !== format_key) return d;
    found = true;

    switch (action) {
      case "update_content":
        return {
          ...d,
          content: content!,
          char_count: content!.length,
          updated_at: now,
        };
      case "approve":
        return { ...d, status: "approved" as const, updated_at: now };
      case "reject":
        return { ...d, status: "rejected" as const, updated_at: now };
      default:
        return d;
    }
  });

  if (!found) {
    return NextResponse.json(
      { error: `Derivative with format '${format_key}' not found` },
      { status: 404 }
    );
  }

  // Check if all derivatives have been reviewed
  const allReviewed = updatedDerivatives.every(
    (d) => d.status === "approved" || d.status === "rejected"
  );

  const updates: Record<string, unknown> = {
    derivatives: JSON.parse(JSON.stringify(updatedDerivatives)),
  };

  if (allReviewed) {
    const anyRejected = updatedDerivatives.some((d) => d.status === "rejected");
    updates.status = anyRejected ? "rejected" : "approved";
  }

  const { error: updateErr } = await supabase
    .from("repurpose_jobs")
    .update(updates)
    .eq("id", job_id);

  if (updateErr) {
    console.error("[derivatives] Update failed:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to update derivative" },
      { status: 500 }
    );
  }

  // On approval, write the derivative as a new content_item with parent_id
  // pointing back to the source — this feeds the lineage tree automatically.
  if (action === "approve") {
    const approvedDerivative = updatedDerivatives.find((d) => d.format === format_key);
    if (approvedDerivative) {
      const platform = DERIVATIVE_PLATFORM_MAP[format_key] ?? "other";
      const title = DERIVATIVE_FORMAT_LABELS[format_key] ?? format_key;
      const { error: insertErr } = await supabase.from("content_items").insert({
        creator_id: creator.id,
        platform,
        title,
        body: approvedDerivative.content,
        parent_content_item_id: (job as { source_item_id: string }).source_item_id,
        published_at: now,
      });
      if (insertErr) {
        console.error("[derivatives] Failed to create lineage content_item:", insertErr.message);
      }
    }
  }

  const finalJobStatus = allReviewed
    ? (updatedDerivatives.some((d) => d.status === "rejected") ? "rejected" : "approved")
    : "review";

  return NextResponse.json({
    derivatives: updatedDerivatives,
    job_status: finalJobStatus,
  });
}

// ─── POST /api/repurpose/derivatives (regenerate) ────────────────────────────

/**
 * Triggers regeneration of a single derivative format.
 *
 * Request body:
 *   {
 *     job_id: string,
 *     format_key: string
 *   }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, format_key } = body as {
    job_id?: string;
    format_key?: string;
  };

  if (!job_id || !format_key) {
    return NextResponse.json(
      { error: "Missing job_id or format_key" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const creator = await getAuthenticatedCreator(supabase);

  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify job exists and belongs to creator
  const { data: job, error } = await supabase
    .from("repurpose_jobs")
    .select("id")
    .eq("id", job_id)
    .eq("creator_id", creator.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Fire Inngest event for regeneration
  try {
    await inngest.send({
      name: "repurpose/derivative.regenerate",
      data: {
        creator_id: creator.id,
        repurpose_job_id: job_id,
        format_key,
      },
    });
  } catch (err) {
    console.error("[derivatives] inngest.send failed:", err);
    return NextResponse.json(
      { error: "Failed to trigger regeneration" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "regenerating", job_id, format_key });
}
