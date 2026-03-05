/**
 * GET /api/repurpose/optimal-times?platform=twitter
 *
 * Computes the top 3 optimal publishing time windows for a given platform
 * based on the creator's own historical engagement data from performance_snapshots.
 *
 * Algorithm:
 *   1. Fetch content_items for this creator on the target platform (with published_at)
 *   2. Fetch performance_snapshots for those content items
 *   3. Group by UTC hour-of-day, summing a weighted engagement score
 *   4. Return the top 3 hours by average score
 *
 * Response: { times: [{ hour: number, label: string }] }
 *   - hour: UTC hour (0–23)
 *   - label: human-readable time label, e.g. "9:00 AM"
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// ─── Engagement scorer ────────────────────────────────────────────────────────

function computeEngagementScore(snap: {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}): number {
  // Weight interactions more than passive views
  return (
    (snap.likes ?? 0) * 2 +
    (snap.comments ?? 0) * 4 +
    (snap.shares ?? 0) * 5 +
    (snap.saves ?? 0) * 3 +
    Math.floor((snap.views ?? 0) / 50)
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");

  if (!platform) {
    return NextResponse.json({ error: "Missing platform" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Step 1: Fetch content items for this platform with published_at
  // Map derivative platforms (twitter, linkedin, instagram, tiktok, newsletter) to
  // content_item platform_name enum values.
  const platformMap: Record<string, string> = {
    newsletter: "other",
  };
  const queryPlatform = platformMap[platform] ?? platform;

  const { data: contentItems } = await supabase
    .from("content_items")
    .select("id, published_at")
    .eq("creator_id", creator.id)
    .eq("platform", queryPlatform)
    .not("published_at", "is", null)
    .limit(500);

  if (!contentItems || contentItems.length === 0) {
    return NextResponse.json({ times: [] });
  }

  const itemIds = contentItems.map((i) => i.id);
  const publishedAtMap = Object.fromEntries(
    contentItems.map((i) => [i.id, i.published_at as string])
  );

  // Step 2: Fetch performance snapshots for those content items
  // Only for this creator (RLS double-check)
  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("content_item_id, views, likes, comments, shares, saves")
    .eq("creator_id", creator.id)
    .in("content_item_id", itemIds)
    .limit(2000);

  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ times: [] });
  }

  // Step 3: Accumulate engagement scores by UTC hour, de-duplicate per content item
  // (use max score across snapshots for the same content item to avoid double-counting
  // multi-day snapshots)
  const bestScorePerItem = new Map<string, number>();

  for (const snap of snapshots) {
    const score = computeEngagementScore(snap);
    const prev = bestScorePerItem.get(snap.content_item_id) ?? 0;
    if (score > prev) {
      bestScorePerItem.set(snap.content_item_id, score);
    }
  }

  // Group best scores by UTC hour of the content item's published_at
  const hourData = new Map<number, { totalScore: number; count: number }>();

  for (const [itemId, score] of bestScorePerItem.entries()) {
    const publishedAt = publishedAtMap[itemId];
    if (!publishedAt) continue;

    const utcHour = new Date(publishedAt).getUTCHours();
    const existing = hourData.get(utcHour) ?? { totalScore: 0, count: 0 };
    hourData.set(utcHour, {
      totalScore: existing.totalScore + score,
      count: existing.count + 1,
    });
  }

  // Step 4: Rank hours by average engagement and take top 3
  const ranked = Array.from(hourData.entries())
    .map(([hour, { totalScore, count }]) => ({
      hour,
      avgScore: totalScore / count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3);

  // Format labels (UTC hour → "9:00 AM" style)
  const times = ranked.map(({ hour }) => {
    // Build a UTC-based label
    const d = new Date(Date.UTC(2024, 0, 1, hour, 0, 0));
    const label = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: true,
    });
    return { hour, label };
  });

  return NextResponse.json({ times });
}
