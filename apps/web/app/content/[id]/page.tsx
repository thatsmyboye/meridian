import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import ContentPerformanceChart from "./ContentPerformanceChart";
import type { ContentSeries, SnapshotPoint } from "./ContentPerformanceChart";

// ─── Types ───────────────────────────────────────────────────────────────────

const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  youtube: { bg: "#fee2e2", color: "#dc2626" },
  instagram: { bg: "#ede9fe", color: "#7c3aed" },
  beehiiv: { bg: "#ffedd5", color: "#f97316" },
  tiktok: { bg: "#f3f4f6", color: "#111827" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function buildSeries(
  item: { id: string; title: string; platform: string },
  snapshots: {
    content_item_id: string;
    day_mark: number | null;
    views: number | null;
    engagement_rate: number | null;
  }[],
  isParent: boolean,
): ContentSeries {
  const itemSnaps = snapshots.filter((s) => s.content_item_id === item.id);
  const points: SnapshotPoint[] = [];

  for (const s of itemSnaps) {
    if (s.day_mark === 1 || s.day_mark === 7 || s.day_mark === 30) {
      points.push({
        dayMark: s.day_mark,
        views: s.views,
        engagementRate: s.engagement_rate,
      });
    }
  }

  // Sort ascending so the line progresses left-to-right
  points.sort((a, b) => a.dayMark - b.dayMark);

  return {
    contentId: item.id,
    title: item.title,
    platform: item.platform,
    isParent,
    snapshots: points,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) notFound();

  // ── Fetch the content item ──
  const { data: item } = await supabase
    .from("content_items")
    .select("id, title, platform, published_at, parent_content_item_id")
    .eq("id", id)
    .eq("creator_id", creator.id)
    .single();

  if (!item) notFound();

  // ── Resolve the root / parent item ──
  let parentItem: { id: string; title: string; platform: string } | null = null;

  if (item.parent_content_item_id) {
    const { data } = await supabase
      .from("content_items")
      .select("id, title, platform, published_at")
      .eq("id", item.parent_content_item_id)
      .eq("creator_id", creator.id)
      .single();

    parentItem = data ?? null;
  }

  // ── Fetch derivative children ──
  const { data: children } = await supabase
    .from("content_items")
    .select("id, title, platform, published_at")
    .eq("parent_content_item_id", id)
    .eq("creator_id", creator.id)
    .order("published_at", { ascending: true });

  const childItems = children ?? [];

  // ── Gather all IDs to fetch snapshots in one query ──
  const allIds = [
    ...(parentItem ? [parentItem.id] : []),
    item.id,
    ...childItems.map((c) => c.id),
  ];

  const { data: snapshots } = await supabase
    .from("performance_snapshots")
    .select("content_item_id, day_mark, views, engagement_rate")
    .in("content_item_id", allIds);

  const allSnaps = snapshots ?? [];

  // ── Build chart series ──
  const chartSeries: ContentSeries[] = [];

  if (parentItem) {
    chartSeries.push(buildSeries(parentItem, allSnaps, true));
  }

  // The current item is "parent" in the chart if it has no parent itself
  chartSeries.push(buildSeries(item, allSnaps, !parentItem));

  for (const child of childItems) {
    chartSeries.push(buildSeries(child, allSnaps, false));
  }

  // ── Latest snapshot for the stat cards ──
  const itemSnaps = allSnaps
    .filter((s) => s.content_item_id === item.id && s.day_mark != null)
    .sort((a, b) => (b.day_mark ?? 0) - (a.day_mark ?? 0));

  const latest = itemSnaps[0] ?? null;

  const badge = PLATFORM_BADGE[item.platform] ?? { bg: "#f3f4f6", color: "#374151" };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ── Back link ── */}
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "#6b7280",
          fontSize: 14,
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        ← Back to dashboard
      </Link>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span
            style={{
              background: badge.bg,
              color: badge.color,
              borderRadius: 5,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            {item.platform}
          </span>
          <span style={{ color: "#9ca3af", fontSize: 13 }}>
            Published {formatDate(item.published_at)}
          </span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 4px",
            color: "#111827",
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </h1>

        {parentItem && (
          <p style={{ color: "#6b7280", fontSize: 13, margin: "8px 0 0" }}>
            Derived from{" "}
            <Link
              href={`/content/${parentItem.id}`}
              style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
            >
              {parentItem.title}
            </Link>
          </p>
        )}
      </div>

      {/* ── Stat cards ── */}
      {latest && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <StatCard
            label="Views"
            value={latest.views != null ? formatNumber(latest.views) : "—"}
            sub={`at day ${latest.day_mark}`}
          />
          <StatCard
            label="Engagement rate"
            value={
              latest.engagement_rate != null
                ? `${latest.engagement_rate.toFixed(2)}%`
                : "—"
            }
            sub={`at day ${latest.day_mark}`}
          />
        </div>
      )}

      {/* ── Performance timeline chart ── */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "20px 20px 16px",
          background: "#fff",
          marginBottom: 32,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 16px",
            color: "#111827",
          }}
        >
          Performance timeline
        </h2>
        <ContentPerformanceChart series={chartSeries} />
      </section>

      {/* ── Derivative children list ── */}
      {childItems.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "0 0 12px",
              color: "#111827",
            }}
          >
            Derivative content ({childItems.length})
          </h2>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {childItems.map((child, i) => {
              const childBadge =
                PLATFORM_BADGE[child.platform] ?? { bg: "#f3f4f6", color: "#374151" };
              const childSnaps = allSnaps
                .filter(
                  (s) => s.content_item_id === child.id && s.day_mark != null,
                )
                .sort((a, b) => (b.day_mark ?? 0) - (a.day_mark ?? 0));
              const childLatest = childSnaps[0];

              return (
                <Link
                  key={child.id}
                  href={`/content/${child.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderTop: i > 0 ? "1px solid #f3f4f6" : undefined,
                    background: "#fff",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.background = "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.background = "#fff")
                  }
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 4,
                      }}
                    >
                      {child.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          background: childBadge.bg,
                          color: childBadge.color,
                          borderRadius: 4,
                          padding: "1px 7px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {child.platform}
                      </span>
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>
                        {formatDate(child.published_at)}
                      </span>
                    </div>
                  </div>

                  {childLatest && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                        {childLatest.views != null
                          ? formatNumber(childLatest.views)
                          : "—"}{" "}
                        <span style={{ fontWeight: 400, color: "#6b7280" }}>views</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {childLatest.engagement_rate != null
                          ? `${childLatest.engagement_rate.toFixed(2)}% engagement`
                          : ""}
                      </div>
                    </div>
                  )}

                  <span style={{ color: "#d1d5db", marginLeft: 12, fontSize: 18 }}>›</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
