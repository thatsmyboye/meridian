import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/repurpose/jobs?status=review
 *
 * Lists repurpose jobs for the authenticated creator, optionally
 * filtered by status.
 */
export async function GET(request: NextRequest) {
  const statusFilter = request.nextUrl.searchParams.get("status");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 401 });
  }

  let query = supabase
    .from("repurpose_jobs")
    .select(
      "id, status, target_platform, selected_formats, derivatives, created_at, updated_at, source_item_id"
    )
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: jobs, error } = await query;

  if (error) {
    console.error("[repurpose/jobs] Query failed:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }

  // Fetch content item titles for all jobs
  const sourceItemIds = [
    ...new Set((jobs ?? []).map((j) => j.source_item_id).filter(Boolean)),
  ];

  const contentItems: Record<string, { title: string; platform: string }> = {};
  if (sourceItemIds.length > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select("id, title, platform")
      .in("id", sourceItemIds);

    for (const item of items ?? []) {
      contentItems[item.id] = { title: item.title, platform: item.platform };
    }
  }

  const enrichedJobs = (jobs ?? []).map((job) => ({
    ...job,
    content_item: contentItems[job.source_item_id] ?? null,
  }));

  return NextResponse.json({ jobs: enrichedJobs });
}
