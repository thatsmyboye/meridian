import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set([
  "youtube",
  "instagram",
  "tiktok",
  "twitter",
  "linkedin",
  "podcast",
  "other",
]);

/**
 * POST /api/repurpose/text-import
 *
 * Creates a content_item (content_type=text_import, no platform) from
 * pasted text and immediately creates a repurpose_job for it.
 *
 * Request body:
 *   {
 *     title: string              – human-readable title for the piece
 *     body: string               – the full text to repurpose
 *     target_platform: string    – intended output platform
 *     selected_formats?: string[] – derivative formats (all if omitted)
 *   }
 *
 * Response:
 *   201 { job_id: string, content_item_id: string }
 *   400 Bad request
 *   401 Unauthorized
 *   500 Server error
 */
export async function POST(request: NextRequest) {
  // ── 1. Parse request body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const { title, body: text, target_platform, selected_formats } = body as {
    title?: string;
    body?: string;
    target_platform?: string;
    selected_formats?: string[];
  };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid title" },
      { status: 400 }
    );
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or invalid body text" },
      { status: 400 }
    );
  }

  if (!target_platform || !VALID_PLATFORMS.has(target_platform)) {
    return NextResponse.json(
      { error: "Missing or invalid target_platform" },
      { status: 400 }
    );
  }

  // ── 2. Verify authenticated creator ────────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 401 });
  }

  // ── 3. Create content_item for the pasted text ─────────────────────────────
  const { data: contentItem, error: contentErr } = await supabase
    .from("content_items")
    .insert({
      creator_id: creator.id,
      title: title.trim(),
      body: text.trim(),
      content_type: "text_import",
      // platform intentionally null – this is not from a connected platform
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (contentErr || !contentItem) {
    console.error("[text-import] Failed to create content_item:", contentErr?.message);
    return NextResponse.json(
      { error: "Failed to create content item" },
      { status: 500 }
    );
  }

  // ── 4. Create the repurpose job ────────────────────────────────────────────
  const { data: job, error: jobErr } = await supabase
    .from("repurpose_jobs")
    .insert({
      creator_id: creator.id,
      source_item_id: contentItem.id,
      target_platform,
      status: "pending",
      selected_formats: selected_formats ?? [],
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("[text-import] Failed to create repurpose_job:", jobErr?.message);
    return NextResponse.json(
      { error: "Failed to create repurpose job" },
      { status: 500 }
    );
  }

  // ── 5. Fire repurpose/job.created – pipeline will use body as transcript ───
  try {
    await inngest.send({
      name: "repurpose/job.created",
      data: {
        creator_id: creator.id,
        repurpose_job_id: job.id,
      },
    });
  } catch (err) {
    console.error("[text-import] inngest.send failed:", err);
    // Non-fatal: job row exists, pipeline can be retried
  }

  return NextResponse.json(
    { job_id: job.id, content_item_id: contentItem.id },
    { status: 201 }
  );
}
