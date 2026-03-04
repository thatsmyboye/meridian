"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import ContentMetricsTable from "./ContentMetricsTable";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentPerformance {
  contentId: string;
  title: string;
  platform: string;
  publishedAt: string;
  totalViews: number;
  engagementRate: number;
  watchTimeMinutes: number | null;
}

export interface DashboardProps {
  content: ContentPerformance[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#dc2626",
  instagram: "#7c3aed",
  beehiiv: "#f97316",
  tiktok: "#000000",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreatorDashboard({ content }: DashboardProps) {
  const [period, setPeriod] = useState<Period>("30d");

  const filtered = useMemo(() => {
    const cutoff = Date.now() - PERIOD_DAYS[period] * 86_400_000;
    return content.filter((c) => new Date(c.publishedAt).getTime() >= cutoff);
  }, [content, period]);

  const totalViews = useMemo(
    () => filtered.reduce((sum, c) => sum + c.totalViews, 0),
    [filtered],
  );

  const avgEngagement = useMemo(() => {
    const withRate = filtered.filter((c) => c.engagementRate > 0);
    if (withRate.length === 0) return 0;
    return (
      withRate.reduce((sum, c) => sum + c.engagementRate, 0) / withRate.length
    );
  }, [filtered]);

  const best = useMemo(
    () =>
      filtered.length > 0
        ? filtered.reduce((a, b) => (a.totalViews >= b.totalViews ? a : b))
        : null,
    [filtered],
  );

  const worst = useMemo(
    () =>
      filtered.length > 0
        ? filtered.reduce((a, b) => (a.totalViews <= b.totalViews ? a : b))
        : null,
    [filtered],
  );

  // Bar chart data — top 10 by views
  const chartData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 10)
        .map((c) => ({
          name: truncate(c.title, 24),
          views: c.totalViews,
          fill: PLATFORM_COLORS[c.platform] ?? "#6b7280",
        })),
    [filtered],
  );

  // ── Empty state ──
  if (content.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          color: "#6b7280",
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          No content data yet
        </p>
        <p style={{ fontSize: 14 }}>
          Connect a platform and sync your content to see performance metrics
          here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Period filter ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 28,
        }}
      >
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

      {/* ── Metric cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <MetricCard label="Total views" value={formatNumber(totalViews)} />
        <MetricCard
          label="Avg engagement rate"
          value={`${avgEngagement.toFixed(2)}%`}
        />
        <MetricCard
          label="Best performing"
          value={best ? truncate(best.title, 32) : "—"}
          sub={
            best
              ? `${formatNumber(best.totalViews)} views · ${best.platform}`
              : undefined
          }
        />
        <MetricCard
          label="Worst performing"
          value={worst ? truncate(worst.title, 32) : "—"}
          sub={
            worst
              ? `${formatNumber(worst.totalViews)} views · ${worst.platform}`
              : undefined
          }
        />
      </div>

      {/* ── Bar chart ── */}
      {chartData.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
              marginTop: 0,
            }}
          >
            Top content by views
          </h2>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatNumber} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [
                    formatNumber(Number(value)),
                    "Views",
                  ]}
                />
                <Bar dataKey="views" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p style={{ color: "#9ca3af", textAlign: "center", marginTop: 24 }}>
          No content published in the last{" "}
          {period === "7d" ? "7" : period === "30d" ? "30" : "90"} days.
        </p>
      )}

      {/* ── Content metrics table ── */}
      <div style={{ marginTop: 48 }}>
        <ContentMetricsTable rows={content} />
      </div>
    </div>
  );
}

// ─── MetricCard ──────────────────────────────────────────────────────────────

function MetricCard({
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
        padding: "16px 18px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
