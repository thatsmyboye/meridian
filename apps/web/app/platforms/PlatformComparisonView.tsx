"use client";

import { useMemo, useState } from "react";
import { formatNumber, PLATFORM_COLORS } from "@/lib/formatters";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = "youtube" | "instagram" | "tiktok" | "beehiiv";

type Period = "7d" | "30d" | "90d";

export interface ContentDataPoint {
  contentId: string;
  platform: Platform;
  publishedAt: string;
  views: number;
  engagementRate: number;
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  openRate: number | null;
  clickRate: number | null;
}

export interface PlatformComparisonViewProps {
  content: ContentDataPoint[];
}

interface PlatformAggregate {
  platform: Platform;
  contentCount: number;
  totalViews: number;
  avgViews: number;
  avgEngagementRate: number;
  /** Score vs. platform industry baseline: 100 = at baseline, 150 = 1.5× average */
  normalizedEngagement: number;
  avgLikes: number;
  avgShares: number;
  avgComments: number;
  avgReach: number;
  avgOpenRate: number | null;
  avgClickRate: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

/**
 * Industry-average engagement rates per platform used as normalisation
 * baselines. A score of 100 means the creator is hitting the typical average;
 * scores above 100 indicate above-average performance for that platform.
 */
const ENGAGEMENT_BASELINES: Record<Platform, number> = {
  youtube: 3.0,
  instagram: 2.0,
  tiktok: 6.0,
  beehiiv: 30.0, // open rate proxy
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  beehiiv: "Beehiiv",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlatformComparisonView({
  content,
}: PlatformComparisonViewProps) {
  const [period, setPeriod] = useState<Period>("30d");

  // ── Filter by period ──
  const filtered = useMemo(() => {
    const cutoff = Date.now() - PERIOD_DAYS[period] * 86_400_000;
    return content.filter((c) => new Date(c.publishedAt).getTime() >= cutoff);
  }, [content, period]);

  // ── Aggregate per platform ──
  const aggregates = useMemo<PlatformAggregate[]>(() => {
    const byPlatform = new Map<Platform, ContentDataPoint[]>();
    for (const c of filtered) {
      const arr = byPlatform.get(c.platform) ?? [];
      arr.push(c);
      byPlatform.set(c.platform, arr);
    }

    return Array.from(byPlatform.entries())
      .map(([platform, items]) => {
        const avgEngage = mean(items.map((i) => i.engagementRate));
        const baseline = ENGAGEMENT_BASELINES[platform] ?? 3.0;
        const normalizedEngagement = (avgEngage / baseline) * 100;

        const openRates = items
          .map((i) => i.openRate ?? 0)
          .filter((r) => r > 0);
        const clickRates = items
          .map((i) => i.clickRate ?? 0)
          .filter((r) => r > 0);

        return {
          platform,
          contentCount: items.length,
          totalViews: items.reduce((s, i) => s + i.views, 0),
          avgViews: mean(items.map((i) => i.views)),
          avgEngagementRate: avgEngage,
          normalizedEngagement,
          avgLikes: mean(items.map((i) => i.likes)),
          avgShares: mean(items.map((i) => i.shares)),
          avgComments: mean(items.map((i) => i.comments)),
          avgReach: mean(items.map((i) => i.reach)),
          avgOpenRate: openRates.length > 0 ? mean(openRates) : null,
          avgClickRate: clickRates.length > 0 ? mean(clickRates) : null,
        };
      })
      .sort((a, b) => b.totalViews - a.totalViews);
  }, [filtered]);

  // ── Radar chart data ──
  // Each axis is normalised to 0–100 relative to the best platform on that
  // metric, so the chart is always fully visible regardless of scale differences.
  const radarData = useMemo(() => {
    if (aggregates.length < 2) return [];

    const maxOf = (fn: (a: PlatformAggregate) => number) =>
      Math.max(...aggregates.map(fn), 1);

    const maxNormEngagement = maxOf((a) => a.normalizedEngagement);
    const maxViews = maxOf((a) => a.avgViews);
    const maxReach = maxOf((a) => a.avgReach);
    const maxInteractions = maxOf(
      (a) => a.avgLikes + a.avgShares + a.avgComments,
    );
    const maxContentCount = maxOf((a) => a.contentCount);

    const axes: { label: string; value: (a: PlatformAggregate) => number; max: number }[] = [
      {
        label: "Engagement",
        value: (a) => a.normalizedEngagement,
        max: maxNormEngagement,
      },
      { label: "Avg views", value: (a) => a.avgViews, max: maxViews },
      { label: "Reach", value: (a) => a.avgReach, max: maxReach },
      {
        label: "Interactions",
        value: (a) => a.avgLikes + a.avgShares + a.avgComments,
        max: maxInteractions,
      },
      { label: "Output", value: (a) => a.contentCount, max: maxContentCount },
    ];

    return axes.map(({ label, value, max }) => {
      const row: Record<string, string | number> = { metric: label };
      for (const agg of aggregates) {
        row[agg.platform] = Math.round((value(agg) / max) * 100);
      }
      return row;
    });
  }, [aggregates]);

  // ── Render ──
  if (content.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "#6b7280" }}>
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          No platform data yet
        </p>
        <p style={{ fontSize: 14 }}>
          Connect platforms and sync content to compare performance across
          channels.
        </p>
      </div>
    );
  }

  const hasPlatforms = aggregates.length > 0;

  return (
    <div>
      {/* ── Period selector ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {(["7d", "30d", "90d"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: period === p ? "#2563eb" : "#e5e7eb",
              background: period === p ? "#2563eb" : "#fff",
              color: period === p ? "#fff" : "#374151",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
      </div>

      {!hasPlatforms ? (
        <p style={{ color: "#9ca3af", textAlign: "center", marginTop: 32 }}>
          No content published in the selected period.
        </p>
      ) : (
        <>
          {/* ── Platform cards ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
              marginBottom: 40,
            }}
          >
            {aggregates.map((agg) => (
              <PlatformCard key={agg.platform} agg={agg} />
            ))}
          </div>

          {/* ── Radar chart ── */}
          {aggregates.length >= 2 ? (
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                Multi-metric comparison
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  marginBottom: 20,
                  marginTop: 0,
                }}
              >
                All axes normalised to 0–100 relative to your best-performing
                platform so you can compare shape, not just scale.
              </p>
              <div style={{ width: "100%", height: 420 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={radarData}
                    margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                  >
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fontSize: 12, fill: "#374151" }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickCount={5}
                    />
                    {aggregates.map((agg) => (
                      <Radar
                        key={agg.platform}
                        name={PLATFORM_LABELS[agg.platform] ?? agg.platform}
                        dataKey={agg.platform}
                        stroke={PLATFORM_COLORS[agg.platform] ?? "#6b7280"}
                        fill={PLATFORM_COLORS[agg.platform] ?? "#6b7280"}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
                    />
                    <Tooltip
                      formatter={(
                        value: number | undefined,
                        name: string | undefined,
                      ) => [
                        value == null ? "—" : `${value}/100`,
                        name != null ? (PLATFORM_LABELS[name] ?? name) : "",
                      ]}
                      contentStyle={{
                        fontSize: 13,
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p
              style={{
                color: "#9ca3af",
                fontSize: 14,
                textAlign: "center",
                marginTop: 8,
                padding: "24px",
                border: "1px dashed #e5e7eb",
                borderRadius: 8,
              }}
            >
              Connect at least two platforms to unlock the multi-metric radar
              chart.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── PlatformCard ─────────────────────────────────────────────────────────────

function PlatformCard({ agg }: { agg: PlatformAggregate }) {
  const color = PLATFORM_COLORS[agg.platform] ?? "#6b7280";
  const label = PLATFORM_LABELS[agg.platform] ?? agg.platform;
  const isNewsletter = agg.platform === "beehiiv";

  const engagementHighlight: "good" | "neutral" | "poor" =
    agg.normalizedEngagement >= 100
      ? "good"
      : agg.normalizedEngagement >= 60
        ? "neutral"
        : "poor";

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "18px 20px",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#9ca3af",
            whiteSpace: "nowrap",
          }}
        >
          {agg.contentCount} piece{agg.contentCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Metrics */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}
      >
        <MetricCell label="Total views" value={formatNumber(agg.totalViews)} />
        <MetricCell
          label="Normalized engagement"
          value={`${Math.round(agg.normalizedEngagement)}`}
          unit="/ baseline"
          highlight={engagementHighlight}
          tooltip={`Raw avg: ${agg.avgEngagementRate.toFixed(2)}% · Industry baseline: ${
            ENGAGEMENT_BASELINES[agg.platform] ?? 3
          }%`}
        />
        <MetricCell
          label="Avg views / post"
          value={formatNumber(agg.avgViews)}
        />
        <MetricCell
          label="Avg engagement"
          value={`${agg.avgEngagementRate.toFixed(2)}%`}
        />
        {!isNewsletter && (
          <>
            <MetricCell
              label="Avg likes"
              value={formatNumber(agg.avgLikes)}
            />
            <MetricCell
              label="Avg shares"
              value={formatNumber(agg.avgShares)}
            />
          </>
        )}
        {isNewsletter && (
          <>
            {agg.avgOpenRate !== null && (
              <MetricCell
                label="Avg open rate"
                value={`${agg.avgOpenRate.toFixed(1)}%`}
              />
            )}
            {agg.avgClickRate !== null && (
              <MetricCell
                label="Avg click rate"
                value={`${agg.avgClickRate.toFixed(1)}%`}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MetricCell ───────────────────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  unit,
  highlight,
  tooltip,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: "good" | "neutral" | "poor";
  tooltip?: string;
}) {
  const valueColor =
    highlight === "good"
      ? "#059669"
      : highlight === "poor"
        ? "#dc2626"
        : "#111827";

  return (
    <div title={tooltip}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{ fontSize: 18, fontWeight: 700, color: valueColor, lineHeight: 1 }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{unit}</span>
        )}
      </div>
    </div>
  );
}
