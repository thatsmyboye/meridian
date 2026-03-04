"use client";

import { useMemo, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContentRow {
  contentId: string;
  title: string;
  platform: string;
  publishedAt: string;
  totalViews: number;
  engagementRate: number;
  watchTimeMinutes: number | null;
}

export interface ContentMetricsTableProps {
  rows: ContentRow[];
}

type SortKey =
  | "title"
  | "platform"
  | "publishedAt"
  | "totalViews"
  | "engagementRate"
  | "watchTimeMinutes";

type SortDir = "asc" | "desc";

// ─── Constants ───────────────────────────────────────────────────────────────

const VIDEO_PLATFORMS = new Set(["youtube", "tiktok"]);

const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  youtube: { bg: "#fee2e2", color: "#dc2626" },
  instagram: { bg: "#ede9fe", color: "#7c3aed" },
  beehiiv: { bg: "#ffedd5", color: "#f97316" },
  tiktok: { bg: "#f3f4f6", color: "#111827" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatWatchTime(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContentMetricsTable({ rows }: ContentMetricsTableProps) {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("publishedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const availablePlatforms = useMemo(
    () => [...new Set(rows.map((r) => r.platform))].sort(),
    [rows],
  );

  const hasVideoContent = useMemo(
    () => rows.some((r) => VIDEO_PLATFORMS.has(r.platform)),
    [rows],
  );

  function handleHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const processed = useMemo(() => {
    let result = [...rows];

    if (platformFilter !== "all") {
      result = result.filter((r) => r.platform === platformFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((r) => new Date(r.publishedAt).getTime() >= from);
    }

    if (dateTo) {
      // Include the full "to" day
      const to = new Date(dateTo).getTime() + 86_400_000;
      result = result.filter((r) => new Date(r.publishedAt).getTime() < to);
    }

    result.sort((a, b) => {
      let av: string | number;
      let bv: string | number;

      switch (sortKey) {
        case "title":
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case "platform":
          av = a.platform;
          bv = b.platform;
          break;
        case "publishedAt":
          av = a.publishedAt;
          bv = b.publishedAt;
          break;
        case "totalViews":
          av = a.totalViews;
          bv = b.totalViews;
          break;
        case "engagementRate":
          av = a.engagementRate;
          bv = b.engagementRate;
          break;
        case "watchTimeMinutes":
          av = a.watchTimeMinutes ?? -1;
          bv = b.watchTimeMinutes ?? -1;
          break;
        default:
          av = a.publishedAt;
          bv = b.publishedAt;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, platformFilter, dateFrom, dateTo, sortKey, sortDir]);

  const hasActiveFilters = platformFilter !== "all" || !!dateFrom || !!dateTo;

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "title", label: "Title", align: "left" },
    { key: "platform", label: "Platform", align: "left" },
    { key: "publishedAt", label: "Published", align: "left" },
    { key: "totalViews", label: "Views", align: "right" },
    { key: "engagementRate", label: "Engagement", align: "right" },
    ...(hasVideoContent
      ? ([{ key: "watchTimeMinutes", label: "Watch time", align: "right" }] as const)
      : []),
  ];

  return (
    <div>
      {/* ── Section header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          All content
        </h2>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {processed.length === rows.length
            ? `${rows.length} item${rows.length !== 1 ? "s" : ""}`
            : `${processed.length} of ${rows.length} items`}
        </span>
      </div>

      {/* ── Filters ── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Platform */}
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            color: "#374151",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="all">All platforms</option>
          {availablePlatforms.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        {/* Date range */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              color: "#374151",
              background: "#fff",
            }}
          />
          <span style={{ color: "#9ca3af", fontSize: 13 }}>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              color: "#374151",
              background: "#fff",
            }}
          />
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setPlatformFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#6b7280",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {columns.map(({ key, label, align }) => (
                <th
                  key={key}
                  onClick={() => handleHeaderClick(key)}
                  style={{
                    padding: "10px 14px",
                    textAlign: align,
                    fontWeight: 600,
                    fontSize: 12,
                    color: sortKey === key ? "#2563eb" : "#6b7280",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid #e5e7eb",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                  {" "}
                  <span style={{ opacity: sortKey === key ? 1 : 0.3 }}>
                    {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {processed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "36px 14px",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
                >
                  No content matches the current filters.
                </td>
              </tr>
            ) : (
              processed.map((row, i) => {
                const badge =
                  PLATFORM_BADGE[row.platform] ?? { bg: "#f3f4f6", color: "#374151" };

                return (
                  <tr
                    key={row.contentId}
                    style={{
                      borderTop: i > 0 ? "1px solid #f3f4f6" : undefined,
                      background: "#fff",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "#fff";
                    }}
                  >
                    {/* Title */}
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#111827",
                        maxWidth: 300,
                      }}
                    >
                      <span
                        title={row.title}
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                      >
                        {row.title}
                      </span>
                    </td>

                    {/* Platform */}
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-block",
                          background: badge.bg,
                          color: badge.color,
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {row.platform}
                      </span>
                    </td>

                    {/* Published */}
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#6b7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(row.publishedAt)}
                    </td>

                    {/* Views */}
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {formatNumber(row.totalViews)}
                    </td>

                    {/* Engagement rate */}
                    <td
                      style={{
                        padding: "12px 14px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: "#111827",
                      }}
                    >
                      {row.engagementRate > 0
                        ? `${row.engagementRate.toFixed(2)}%`
                        : "—"}
                    </td>

                    {/* Watch time (video platforms only) */}
                    {hasVideoContent && (
                      <td
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: "#6b7280",
                        }}
                      >
                        {VIDEO_PLATFORMS.has(row.platform)
                          ? formatWatchTime(row.watchTimeMinutes)
                          : "—"}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
