import { createServerClient } from "@/lib/supabase/server";
import CreatorDashboard from "./CreatorDashboard";
import type { DashboardProps } from "./CreatorDashboard";

/**
 * / — Meridian dashboard home
 *
 * Server component. Fetches the creator's content and latest performance
 * snapshots, then hands the data to the client-side CreatorDashboard
 * component for interactive filtering and charting.
 *
 * Also checks whether any connected platform has status = "reauth_required"
 * and renders a sticky alert banner.
 */
export default async function Home() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reauthPlatforms: string[] = [];
  let dashboardContent: DashboardProps["content"] = [];

  if (user) {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (creator) {
      // Check for platforms needing re-auth
      const { data: platforms } = await supabase
        .from("connected_platforms")
        .select("platform")
        .eq("creator_id", creator.id)
        .eq("status", "reauth_required");

      reauthPlatforms = (platforms ?? []).map((p) => p.platform as string);

      // Fetch content published in the last 90 days (widest filter window)
      const cutoff = new Date(
        Date.now() - 90 * 86_400_000,
      ).toISOString();

      const { data: contentItems } = await supabase
        .from("content_items")
        .select("id, title, platform, published_at")
        .eq("creator_id", creator.id)
        .gte("published_at", cutoff)
        .order("published_at", { ascending: false });

      if (contentItems && contentItems.length > 0) {
        // Fetch the latest performance snapshot per content item.
        // We use distinct-on-like behaviour by ordering by snapshot_date desc
        // and grabbing snapshots for these content items.
        const contentIds = contentItems.map((c) => c.id);

        const { data: snapshots } = await supabase
          .from("performance_snapshots")
          .select(
            "content_item_id, views, engagement_rate, snapshot_date",
          )
          .in("content_item_id", contentIds)
          .order("snapshot_date", { ascending: false });

        // Keep only the latest snapshot per content item
        const latestByContent = new Map<
          string,
          { views: number; engagementRate: number }
        >();

        for (const snap of snapshots ?? []) {
          if (!latestByContent.has(snap.content_item_id)) {
            latestByContent.set(snap.content_item_id, {
              views: snap.views ?? 0,
              engagementRate: snap.engagement_rate ?? 0,
            });
          }
        }

        dashboardContent = contentItems.map((item) => {
          const perf = latestByContent.get(item.id);
          return {
            contentId: item.id,
            title: item.title,
            platform: item.platform as string,
            publishedAt: item.published_at,
            totalViews: perf?.views ?? 0,
            engagementRate: perf?.engagementRate ?? 0,
          };
        });
      }
    }
  }

  const youtubeReauthRequired = reauthPlatforms.includes("youtube");

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {youtubeReauthRequired && (
        <div
          role="alert"
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#78350f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span>
            <strong>Action required:</strong> Your YouTube connection has
            expired. Analytics have been paused until you reconnect.
          </span>
          <a
            href="/api/connect/youtube"
            style={{
              display: "inline-block",
              background: "#dc2626",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Reconnect YouTube
          </a>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>
          Dashboard
        </h1>
        <p style={{ color: "#6b7280", margin: 0, fontSize: 15 }}>
          Your content performance at a glance.
        </p>
      </div>

      <CreatorDashboard content={dashboardContent} />
    </main>
  );
}
