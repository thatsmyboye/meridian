"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNumber, PLATFORM_BADGE } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsightEvidenceItem {
  contentId: string;
  title: string;
  platform: string;
  publishedAt: string;
  engagementRate: number;
  totalViews: number;
}

export interface DashboardInsight {
  id: string;
  insight_type: string;
  summary: string;
  narrative: string | null;
  confidence_label: string | null;
  confidence: number;
  generated_at: string;
  evidence_json: Record<string, unknown>;
  supporting_content: InsightEvidenceItem[];
}

interface InsightsPanelProps {
  insights: DashboardInsight[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INSIGHT_META: Record<string, { icon: string; label: string }> = {
  day_of_week: { icon: "📅", label: "Publishing day" },
  content_type: { icon: "🎬", label: "Content format" },
  length_bucket: { icon: "⏱️", label: "Content length" },
  posting_frequency: { icon: "📈", label: "Posting frequency" },
};

const CONFIDENCE_BADGE: Record<string, { bg: string; color: string }> = {
  Strong: { bg: "#dcfce7", color: "#15803d" },
  Moderate: { bg: "#fef9c3", color: "#854d0e" },
  Emerging: { bg: "#dbeafe", color: "#1e40af" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dataWindowLabel(insight: DashboardInsight): string {
  const ev = insight.evidence_json;
  if (insight.insight_type === "posting_frequency") {
    const weeks = ev.weeks_analysed as number | undefined;
    return weeks != null ? `${weeks} weeks of data` : "Frequency analysis";
  }
  const total = ev.total_posts_analysed as number | undefined;
  return total != null ? `Based on ${total} posts` : "Pattern analysis";
}

// ─── InsightCard ──────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  animationDelay,
}: {
  insight: DashboardInsight;
  animationDelay: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const meta = INSIGHT_META[insight.insight_type] ?? {
    icon: "💡",
    label: insight.insight_type.replace(/_/g, " "),
  };
  const confidenceBadge = insight.confidence_label
    ? CONFIDENCE_BADGE[insight.confidence_label]
    : null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
        animation: "fadeSlideIn 0.4s ease both",
        animationDelay: `${animationDelay}ms`,
      }}
    >
      {/* ── Card header ── */}
      <div style={{ padding: "18px 20px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{meta.icon}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#9ca3af",
            }}
          >
            {meta.label}
          </span>
          {confidenceBadge && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 99,
                background: confidenceBadge.bg,
                color: confidenceBadge.color,
              }}
            >
              {insight.confidence_label}
            </span>
          )}
        </div>

        {/* Headline */}
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#111827",
            lineHeight: 1.45,
            margin: 0,
            marginBottom: 8,
          }}
        >
          {insight.summary}
        </p>

        {/* Narrative */}
        {insight.narrative && (
          <p
            style={{
              fontSize: 14,
              color: "#4b5563",
              lineHeight: 1.6,
              margin: 0,
              marginBottom: 10,
            }}
          >
            {insight.narrative}
          </p>
        )}

        {/* Data window label */}
        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            margin: 0,
            marginBottom: 14,
          }}
        >
          {dataWindowLabel(insight)}
        </p>
      </div>

      {/* ── Evidence toggle ── */}
      {insight.supporting_content.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "10px 20px",
              background: expanded ? "#f9fafb" : "transparent",
              border: "none",
              borderTop: "1px solid #f3f4f6",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 0.2s",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                fontSize: 10,
              }}
            >
              ▶
            </span>
            {expanded ? "Hide" : "Show"} contributing content (
            {insight.supporting_content.length})
          </button>

          {/* ── Evidence list ── */}
          {expanded && (
            <div style={{ background: "#f9fafb", padding: "0 20px 16px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingTop: 12,
                }}
              >
                {insight.supporting_content.map((item, i) => {
                  const badge = PLATFORM_BADGE[item.platform];
                  return (
                    <div
                      key={item.contentId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#d1d5db",
                          width: 16,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#111827",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 3,
                          }}
                        >
                          {badge && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: badge.bg,
                                color: badge.color,
                              }}
                            >
                              {item.platform}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            {formatNumber(item.totalViews)} views
                          </span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            {(item.engagementRate * 100).toFixed(1)}% eng
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/content/${item.contentId}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#2563eb",
                          textDecoration: "none",
                          flexShrink: 0,
                          padding: "4px 8px",
                          border: "1px solid #bfdbfe",
                          borderRadius: 5,
                          background: "#eff6ff",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Deep dive →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── InsightsPanel ────────────────────────────────────────────────────────────

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 14,
          marginTop: 0,
          color: "#111827",
        }}
      >
        Pattern Insights
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        {insights.map((insight, i) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            animationDelay={i * 80}
          />
        ))}
      </div>
    </div>
  );
}
