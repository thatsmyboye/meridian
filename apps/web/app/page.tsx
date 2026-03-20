import { Suspense } from "react";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import CreatorDashboard from "./CreatorDashboard";
import type { DashboardProps } from "./CreatorDashboard";
import InsightsPanelClient from "./InsightsPanelClient";
import type { DashboardInsight, InsightEvidenceItem } from "./InsightsPanel";
import PublishNotificationBell from "./PublishNotificationBell";
import UpgradedConfetti from "./UpgradedConfetti";
import LandingPage from "./LandingPage";

/**
 * / — Meridian dashboard home
 *
 * Server component. Fetches the creator's content, latest performance
 * snapshots, and pattern insights, then hands the data to the client-side
 * components for interactive filtering and charting.
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
  let dashboardInsights: DashboardInsight[] = [];
  let creatorId: string | null = null;
  let initialNotifications: {
    id: string;
    type: "published" | "failed_publish";
    repurpose_job_id: string;
    format_key: string;
    platform_label: string;
    content_title: string | null;
    external_url: string | null;
    retry_url: string | null;
    read_at: string | null;
    created_at: string;
  }[] = [];

  if (user) {
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (creator) {
      creatorId = creator.id as string;

      // Check for platforms needing re-auth
      const { data: platforms } = await supabase
        .from("connected_platforms")
        .select("platform")
        .eq("creator_id", creator.id)
        .eq("status", "reauth_required");

      reauthPlatforms = (platforms ?? []).map((p) => p.platform as string);

      // Fetch the 20 most recent publish notifications for the bell
      const { data: notifRows } = await supabase
        .from("publish_notifications")
        .select(
          "id, type, repurpose_job_id, format_key, platform_label, content_title, external_url, retry_url, read_at, created_at"
        )
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(20);

      initialNotifications = (notifRows ?? []).map((n) => ({
        id: n.id as string,
        type: n.type as "published" | "failed_publish",
        repurpose_job_id: n.repurpose_job_id as string,
        format_key: n.format_key as string,
        platform_label: n.platform_label as string,
        content_title: n.content_title as string | null,
        external_url: n.external_url as string | null,
        retry_url: n.retry_url as string | null,
        read_at: n.read_at as string | null,
        created_at: n.created_at as string,
      }));

      // Fetch content published in the last 364 days (52 weeks for the heatmap;
      // the dashboard's 7d/30d/90d filters narrow it down client-side)
      const cutoff = new Date(
        Date.now() - 364 * 86_400_000,
      ).toISOString();

      const { data: contentItems } = await supabase
        .from("content_items")
        .select("id, title, platform, published_at, duration_seconds")
        .eq("creator_id", creator.id)
        .gte("published_at", cutoff)
        .order("published_at", { ascending: false });

      // Fetch pattern insights in parallel with snapshot data
      const [snapshotsResult, insightsResult] = await Promise.all([
        contentItems && contentItems.length > 0
          ? supabase
              .from("performance_snapshots")
              .select(
                "content_item_id, views, engagement_rate, watch_time_minutes, snapshot_at",
              )
              .in("content_item_id", contentItems.map((c) => c.id))
              .order("snapshot_at", { ascending: false })
          : Promise.resolve({ data: null }),
        supabase
          .from("pattern_insights")
          .select(
            "id, insight_type, summary, narrative, confidence_label, confidence, generated_at, dismissed_at, evidence_json",
          )
          .eq("creator_id", creator.id)
          .eq("is_dismissed", false)
          .order("generated_at", { ascending: false })
          .limit(4),
      ]);

      if (contentItems && contentItems.length > 0) {
        const snapshots = snapshotsResult.data;

        // Keep only the latest snapshot per content item
        const latestByContent = new Map<
          string,
          { views: number; engagementRate: number; watchTimeMinutes: number | null }
        >();

        for (const snap of snapshots ?? []) {
          if (!latestByContent.has(snap.content_item_id)) {
            latestByContent.set(snap.content_item_id, {
              views: snap.views ?? 0,
              engagementRate: snap.engagement_rate ?? 0,
              watchTimeMinutes: snap.watch_time_minutes ?? null,
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
            watchTimeMinutes: perf?.watchTimeMinutes ?? null,
          };
        });

        // Build enriched lookup for evidence derivation
        const enrichedContent = contentItems.map((item) => {
          const perf = latestByContent.get(item.id);
          return {
            contentId: item.id,
            title: item.title,
            platform: item.platform as string,
            publishedAt: item.published_at,
            durationSeconds: item.duration_seconds as number | null,
            totalViews: perf?.views ?? 0,
            engagementRate: perf?.engagementRate ?? 0,
          };
        });

        // Derive supporting content items for each insight
        dashboardInsights = (insightsResult.data ?? []).map((row) => {
          const evidence = (row.evidence_json ?? {}) as Record<string, unknown>;
          const supporting = deriveSupportingContent(
            row.insight_type as string,
            evidence,
            enrichedContent,
          );
          return {
            id: row.id as string,
            insight_type: row.insight_type as string,
            summary: row.summary as string,
            narrative: row.narrative as string | null,
            confidence_label: row.confidence_label as string | null,
            confidence: row.confidence as number,
            generated_at: row.generated_at as string,
            dismissed_at: row.dismissed_at as string | null,
            evidence_json: evidence,
            supporting_content: supporting,
          };
        });
      } else {
        // No content items yet, but still surface insights if they exist
        dashboardInsights = (insightsResult.data ?? []).map((row) => ({
          id: row.id as string,
          insight_type: row.insight_type as string,
          summary: row.summary as string,
          narrative: row.narrative as string | null,
          confidence_label: row.confidence_label as string | null,
          confidence: row.confidence as number,
          generated_at: row.generated_at as string,
          dismissed_at: row.dismissed_at as string | null,
          evidence_json: (row.evidence_json ?? {}) as Record<string, unknown>,
          supporting_content: [],
        }));
      }
    }
  }

  const youtubeReauthRequired = reauthPlatforms.includes("youtube");

  // Unauthenticated landing page
  if (!user) {
    return <LandingPage />;
  }

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Confetti celebration on successful plan upgrade */}
      <Suspense>
        <UpgradedConfetti />
      </Suspense>

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Dashboard
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {creatorId && (
              <PublishNotificationBell
                creatorId={creatorId}
                initialNotifications={initialNotifications}
              />
            )}
            <Link
              href="/repurpose/new"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                textDecoration: "none",
                padding: "7px 14px",
                borderRadius: 7,
                background: "#2563eb",
                whiteSpace: "nowrap",
              }}
            >
              + New repurpose
            </Link>
          </div>
        </div>
        <p style={{ color: "#6b7280", margin: 0, fontSize: 15 }}>
          Your content performance at a glance.
        </p>
      </div>

      <InsightsPanelClient
        insights={dashboardInsights}
        content={dashboardContent.map(({ publishedAt }) => ({ publishedAt }))}
      />

      <Suspense>
        <CreatorDashboard content={dashboardContent} />
      </Suspense>
    </main>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EnrichedContentItem = {
  contentId: string;
  title: string;
  platform: string;
  publishedAt: string;
  durationSeconds: number | null;
  totalViews: number;
  engagementRate: number;
};

/**
 * Returns the top 5 content items that contributed most to the given pattern
 * insight, sorted descending by engagement rate.
 */
function deriveSupportingContent(
  insightType: string,
  evidence: Record<string, unknown>,
  content: EnrichedContentItem[],
): InsightEvidenceItem[] {
  let candidates: EnrichedContentItem[] = [];

  if (insightType === "day_of_week") {
    const bestDay = (evidence.best_day as { day: number } | undefined)?.day;
    if (bestDay != null) {
      candidates = content.filter(
        (c) => new Date(c.publishedAt).getDay() === bestDay,
      );
    }
  } else if (insightType === "content_type") {
    const bestType = evidence.best_type as string | undefined;
    if (bestType) {
      candidates = content.filter((c) => c.platform === bestType);
    }
  } else if (insightType === "length_bucket") {
    const bestBucket = evidence.best_bucket as string | undefined;
    if (bestBucket) {
      candidates = content.filter(
        (c) => contentLengthBucket(c.platform, c.durationSeconds) === bestBucket,
      );
    }
  } else if (insightType === "posting_frequency") {
    // Find content from high-frequency weeks (weeks with post count > median)
    const medianPosts = evidence.median_posts_per_week as number | undefined;
    if (medianPosts != null) {
      const byWeek = new Map<string, EnrichedContentItem[]>();
      for (const c of content) {
        const key = isoWeekKey(new Date(c.publishedAt));
        const bucket = byWeek.get(key) ?? [];
        bucket.push(c);
        byWeek.set(key, bucket);
      }
      for (const weekItems of byWeek.values()) {
        if (weekItems.length > medianPosts) {
          candidates.push(...weekItems);
        }
      }
    }
  }

  return candidates
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5)
    .map(({ contentId, title, platform, publishedAt, totalViews, engagementRate }) => ({
      contentId,
      title,
      platform,
      publishedAt,
      totalViews,
      engagementRate,
    }));
}

function contentLengthBucket(
  platform: string,
  durationSeconds: number | null,
): string {
  if (platform === "beehiiv" || durationSeconds === null) return "newsletter";
  if (durationSeconds < 60) return "short";
  if (durationSeconds < 600) return "medium";
  return "long";
}

function isoWeekKey(date: Date): string {
  // Use ISO week: find Thursday of this week's week, then get its year-week.
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
