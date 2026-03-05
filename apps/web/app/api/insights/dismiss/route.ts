import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/insights/dismiss
 *
 * Dismisses (archives) an insight by marking it with dismissed_at timestamp.
 * Dismissed insights are excluded from the dashboard display but are retained
 * in the database for historical tracking.
 *
 * Request body:
 *   {
 *     insight_id: string (UUID)
 *   }
 *
 * Response:
 *   200 { dismissed: true }
 *   400 Bad request (missing insight_id)
 *   401 Unauthorized (not logged in)
 *   404 Not found (insight doesn't exist or doesn't belong to creator)
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

  const { insight_id } = body as { insight_id?: string };

  if (!insight_id || typeof insight_id !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid insight_id" },
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
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    return NextResponse.json(
      { error: "Creator not found" },
      { status: 401 }
    );
  }

  // ── 4. Verify the insight belongs to this creator ──────────────────────────
  const { data: insight, error: selectErr } = await supabase
    .from("pattern_insights")
    .select("id")
    .eq("id", insight_id)
    .eq("creator_id", creator.id)
    .single();

  if (selectErr || !insight) {
    return NextResponse.json(
      { error: "Insight not found" },
      { status: 404 }
    );
  }

  // ── 5. Mark the insight as dismissed ───────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("pattern_insights")
    .update({ dismissed_at: new Date().toISOString(), is_dismissed: true })
    .eq("id", insight_id)
    .eq("creator_id", creator.id);

  if (updateErr) {
    console.error("[insights/dismiss] Update failed:", updateErr.message);
    return NextResponse.json(
      { error: "Failed to dismiss insight" },
      { status: 500 }
    );
  }

  return NextResponse.json({ dismissed: true }, { status: 200 });
}
