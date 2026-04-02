import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/analytics/run
 *
 * Triggers an on-demand pattern analysis for the authenticated creator,
 * bypassing the 30-day wait gate that the weekly cron enforces.
 *
 * Eligibility: creator must have content from ≥2 distinct platforms,
 * confirming they have synced multiple platforms with actual content.
 *
 * Fires the existing `patterns/analysis.requested` event, which is handled
 * by `computeCreatorPatterns`. That function has no 30-day gate itself —
 * it analyses whatever performance snapshots are available.
 *
 * Responses:
 *   202 { enqueued: true }
 *   401 Unauthorized (not authenticated or creator profile not found)
 *   422 Unprocessable Entity (fewer than 2 distinct synced platforms)
 *   500 Server error (database query or inngest.send failed)
 */
export async function POST(_request: NextRequest) {
  // ── 1. Verify authenticated user ────────────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Look up the creator profile ──────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 401 });
  }

  // ── 3. Count distinct platforms with synced content ─────────────────────────
  const { data: platformRows, error: platformErr } = await supabase
    .from("content_items")
    .select("platform")
    .eq("creator_id", creator.id);

  if (platformErr) {
    console.error(
      "[analytics/run] Failed to query platforms:",
      platformErr.message
    );
    return NextResponse.json(
      { error: "Failed to check eligibility" },
      { status: 500 }
    );
  }

  const distinctPlatforms = new Set(
    (platformRows ?? []).map((row) => row.platform as string)
  );

  // ── 4. Gate: require content from ≥2 distinct platforms ─────────────────────
  if (distinctPlatforms.size < 2) {
    return NextResponse.json(
      {
        error: "insufficient_platforms",
        message:
          "Connect and sync content from at least 2 platforms to run an on-demand analysis.",
        platforms_found: distinctPlatforms.size,
      },
      { status: 422 }
    );
  }

  // ── 5. Enqueue the pattern analysis ─────────────────────────────────────────
  try {
    await inngest.send({
      name: "patterns/analysis.requested",
      data: {
        creator_id: creator.id as string,
      },
    });
  } catch (err) {
    console.error("[analytics/run] inngest.send failed:", err);
    return NextResponse.json(
      { error: "Failed to enqueue analysis" },
      { status: 500 }
    );
  }

  return NextResponse.json({ enqueued: true }, { status: 202 });
}
