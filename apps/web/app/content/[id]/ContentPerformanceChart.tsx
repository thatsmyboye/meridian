"use client";

import { useState, useMemo } from "react";
import { formatNumber, PLATFORM_COLORS } from "@/lib/formatters";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SnapshotPoint {
  dayMark: 1 | 7 | 30;
  views: number | null;
  engagementRate: number | null;
}

export interface ContentSeries {
  contentId: string;
  title: string;
  platform: string;
  isParent: boolean;
  snapshots: SnapshotPoint[];
}

export interface ContentPerformanceChartProps {
  series: ContentSeries[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

type Metric = "views" | "engagement";
type Window = 1 | 7 | 30;

const DAY_MARKS: Window[] = [1, 7, 30];

const FALLBACK_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#7c3aed",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seriesColor(s: ContentSeries, index: number): string {
  return PLATFORM_COLORS[s.platform] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContentPerformanceChart({ series }: ContentPerformanceChartProps) {
  const [metric, setMetric] = useState<Metric>("views");
  const [maxWindow, setMaxWindow] = useState<Window>(30);

  const visibleDayMarks = DAY_MARKS.filter((d) => d <= maxWindow);

  // Build the flat data array recharts expects
  const chartData = useMemo(
    () =>
      visibleDayMarks.map((dm) => {
        const row: Record<string, string | number | null> = {
          label: `Day ${dm}`,
        };
        for (const s of series) {
          const snap = s.snapshots.find((p) => p.dayMark === dm);
          if (metric === "views") {
            row[s.contentId] = snap?.views ?? null;
          } else {
            row[s.contentId] = snap?.engagementRate ?? null;
          }
        }
        return row;
      }),
    [series, metric, maxWindow], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hasData = series.some((s) => s.snapshots.length > 0);

  return (
    <div>
      {/* ── Controls ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {/* Metric toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["views", "engagement"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: metric === m ? "#2563eb" : "#e5e7eb",
                background: metric === m ? "#2563eb" : "#fff",
                color: metric === m ? "#fff" : "#374151",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {m === "views" ? "Views" : "Engagement Rate"}
            </button>
          ))}
        </div>

        {/* Window filter */}
        <div style={{ display: "flex", gap: 6 }}>
          {([1, 7, 30] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setMaxWindow(w)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: maxWindow === w ? "#6b7280" : "#e5e7eb",
                background: maxWindow === w ? "#f3f4f6" : "#fff",
                color: maxWindow === w ? "#111827" : "#6b7280",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {w === 1 ? "Day 1" : w === 7 ? "Day 7" : "Day 30"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      {!hasData ? (
        <div
          style={{
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: 14,
            border: "1px dashed #e5e7eb",
            borderRadius: 8,
          }}
        >
          No performance snapshots recorded yet.
        </div>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={metric === "views" ? formatNumber : (v) => `${v}%`}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                width={metric === "views" ? 48 : 44}
              />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => {
                  const s = series.find((s) => s.contentId === name);
                  const label = s ? truncate(s.title, 40) : (name ?? "");
                  const formatted =
                    value == null
                      ? "—"
                      : metric === "views"
                        ? formatNumber(value)
                        : `${value.toFixed(2)}%`;
                  return [formatted, label];
                }}
                contentStyle={{ fontSize: 13, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <Legend
                formatter={(value) => {
                  const s = series.find((s) => s.contentId === value);
                  if (!s) return value;
                  return (
                    <span style={{ fontSize: 12, color: "#374151" }}>
                      {truncate(s.title, 36)}
                      {s.isParent && (
                        <span
                          style={{
                            marginLeft: 5,
                            fontSize: 10,
                            background: "#f3f4f6",
                            color: "#6b7280",
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          original
                        </span>
                      )}
                    </span>
                  );
                }}
              />
              {series.map((s, i) => (
                <Line
                  key={s.contentId}
                  type="monotone"
                  dataKey={s.contentId}
                  stroke={seriesColor(s, i)}
                  strokeWidth={s.isParent ? 2.5 : 1.5}
                  strokeDasharray={s.isParent ? undefined : "5 3"}
                  dot={{ r: 4, fill: seriesColor(s, i) }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
