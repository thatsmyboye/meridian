import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";
import { checkRepurposeMonthlyLimit } from "@/lib/subscription";
import type { SubscriptionTier } from "@/lib/subscription";

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
 * POST /api/repurpose
 *
 * Creates a repurpose_jobs row with status=pending for the given
 * content item and target platform.
 *
 * Request body:
 *   {
 *     content_item_id: string (UUID)
 *     target_platform: string (platform_name enum value)
 *   }
 *
 * Response:
 *   201 { job_id: string }
 *   400 Bad request (missing or invalid fields)
 *   401 Unauthorized (not logged in or creator not found)
 *   404 content_item_id not found or doesn't belong to creator
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

  const { content_item_id, target_platform, selected_formats } = body as {
    content_item_id?: string;
    target_platform?: string;
    selected_formats?: string[];
  };

  if (!content_item_id || typeof content_item_id !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid content_item_id" },
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

  // ── 3. Look up the creator ─────────────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id, subscription_tier")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 401 });
  }

  // ── 3a. Repurpose job monthly quota gate ───────────────────────────────────
  const tier = ((creator.subscription_tier as SubscriptionTier | null) ?? "free");
  const quotaCheck = await checkRepurposeMonthlyLimit(creator.id as string, tier);
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        error: "repurpose_limit_reached",
        message: `You have used all ${quotaCheck.limit} repurpose jobs for this month on the ${tier} plan.`,
        current: quotaCheck.current,
        limit: quotaCheck.limit,
        tier,
      },
      { status: 403 }
    );
  }

  // ── 4. Verify the content item belongs to this creator ─────────────────────
  const { data: contentItem, error: contentErr } = await supabase
    .from("content_items")
    .select("id")
    .eq("id", content_item_id)
    .eq("creator_id", creator.id)
    .single();

  if (contentErr || !contentItem) {
    return NextResponse.json(
      { error: "Content item not found" },
      { status: 404 }
    );
  }

  // ── 5. Insert the repurpose job ────────────────────────────────────────────
  const { data: job, error: insertErr } = await supabase
    .from("repurpose_jobs")
    .insert({
      creator_id: creator.id,
      source_item_id: content_item_id,
      target_platform,
      status: "pending",
      selected_formats: selected_formats ?? [],
    })
    .select("id")
    .single();

  if (insertErr || !job) {
    console.error("[repurpose] Insert failed:", insertErr?.message);
    return NextResponse.json(
      { error: "Failed to create repurpose job" },
      { status: 500 }
    );
  }

  // ── 6. Fire repurpose/job.created event to kick off the pipeline ───────────
  try {
    await inngest.send({
      name: "repurpose/job.created",
      data: {
        creator_id: creator.id,
        repurpose_job_id: job.id,
      },
    });
  } catch (err) {
    console.error("[repurpose] inngest.send failed:", err);
    // Non-fatal: job row exists, pipeline can be retried separately
  }

  return NextResponse.json({ job_id: job.id }, { status: 201 });
}
