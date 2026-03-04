import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import PlatformComparisonView from "./PlatformComparisonView";
import type { ContentDataPoint } from "./PlatformComparisonView";

/**
 * /platforms — Cross-platform performance comparison
 *
 * Server component. Fetches the creator's content items and their latest
 * performance snapshots for the past 90 days, then hands normalised per-post
 * data to the client component for interactive aggregation, filtering, and
 * visualisation (radar chart + platform cards).
 */
export default async function PlatformsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let content: ContentDataPoint[] = [];

  if (user) {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (creator) {
      // Fetch the widest window (90 days); the client filters down interactively.
      const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();

      const { data: contentItems } = await supabase
        .from("content_items")
        .select("id, platform, published_at")
        .eq("creator_id", creator.id)
        .gte("published_at", cutoff)
        .order("published_at", { ascending: false });

      if (contentItems && contentItems.length > 0) {
        const contentIds = contentItems.map((c) => c.id);

        const { data: snapshots } = await supabase
          .from("performance_snapshots")
          .select(
            "content_item_id, views, engagement_rate, likes, shares, comments, reach, open_rate, click_rate, snapshot_date",
          )
          .in("content_item_id", contentIds)
          .order("snapshot_date", { ascending: false });

        // Keep only the latest snapshot per content item (snapshots already
        // ordered descending so first hit per content_item_id is latest).
        const latestByContent = new Map<
          string,
          {
            views: number;
            engagementRate: number;
            likes: number;
            shares: number;
            comments: number;
            reach: number;
            openRate: number | null;
            clickRate: number | null;
          }
        >();

        for (const snap of snapshots ?? []) {
          if (!latestByContent.has(snap.content_item_id)) {
            latestByContent.set(snap.content_item_id, {
              views: snap.views ?? 0,
              engagementRate: snap.engagement_rate ?? 0,
              likes: snap.likes ?? 0,
              shares: snap.shares ?? 0,
              comments: snap.comments ?? 0,
              reach: snap.reach ?? 0,
              openRate: (snap as { open_rate?: number | null }).open_rate ?? null,
              clickRate: (snap as { click_rate?: number | null }).click_rate ?? null,
            });
          }
        }

        content = contentItems.map((item) => {
          const perf = latestByContent.get(item.id);
          return {
            contentId: item.id,
            platform: item.platform as ContentDataPoint["platform"],
            publishedAt: item.published_at,
            views: perf?.views ?? 0,
            engagementRate: perf?.engagementRate ?? 0,
            likes: perf?.likes ?? 0,
            shares: perf?.shares ?? 0,
            comments: perf?.comments ?? 0,
            reach: perf?.reach ?? 0,
            openRate: perf?.openRate ?? null,
            clickRate: perf?.clickRate ?? null,
          };
        });
      }
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Back nav */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/"
          style={{
            color: "#6b7280",
            textDecoration: "none",
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Dashboard
        </Link>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>
          Platform comparison
        </h1>
        <p style={{ color: "#6b7280", margin: 0, fontSize: 15 }}>
          Side-by-side view of how your content performs across every connected
          platform.
        </p>
      </div>

      <PlatformComparisonView content={content} />
    </main>
  );
}
