"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Derivative {
  format: string;
  content: string;
  platform: string;
  char_count: number;
  status: "pending" | "approved" | "rejected";
  previous_drafts: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  jobId: string;
  jobStatus: string;
  derivatives: Derivative[];
  sourceTranscript: string;
  contentTitle: string;
  contentPlatform: string;
  contentBody: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  twitter_thread: "Twitter / X Thread",
  linkedin_post: "LinkedIn Post",
  instagram_caption: "Instagram Caption",
  newsletter_blurb: "Newsletter Blurb",
  tiktok_script: "TikTok Script",
};

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 1400,
  linkedin: 3000,
  instagram: 2200,
  newsletter: 2000,
  tiktok: 1000,
};

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  twitter: { bg: "#e8f5fd", color: "#1d9bf0" },
  linkedin: { bg: "#e8f0fe", color: "#0a66c2" },
  instagram: { bg: "#fce7f3", color: "#e1306c" },
  newsletter: { bg: "#f0fdf4", color: "#16a34a" },
  tiktok: { bg: "#f0f0f0", color: "#000000" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DerivativeReviewClient({
  jobId,
  jobStatus: initialJobStatus,
  derivatives: initialDerivatives,
  sourceTranscript,
  contentTitle,
  contentPlatform,
  contentBody,
}: Props) {
  const [derivatives, setDerivatives] = useState<Derivative[]>(initialDerivatives);
  const [activeTab, setActiveTab] = useState<string>(
    initialDerivatives[0]?.format ?? ""
  );
  const [, setJobStatus] = useState(initialJobStatus);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Polling for regeneration updates
  useEffect(() => {
    const isRegenerating = Object.values(regenerating).some(Boolean);
    if (!isRegenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/repurpose/derivatives?job_id=${jobId}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setDerivatives(data.derivatives);

        // Check if any regenerating formats have updated
        const stillRegenerating: Record<string, boolean> = {};
        for (const [key, val] of Object.entries(regenerating)) {
          if (!val) continue;
          const newD = (data.derivatives as Derivative[]).find(
            (d) => d.format === key
          );
          const oldD = derivatives.find((d) => d.format === key);
          if (newD && oldD && newD.content !== oldD.content) {
            stillRegenerating[key] = false;
          } else {
            stillRegenerating[key] = true;
          }
        }
        setRegenerating(stillRegenerating);
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [regenerating, jobId, derivatives]);

  // Auto-save debounced
  const autoSave = useCallback(
    (formatKey: string, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch("/api/repurpose/derivatives", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: jobId,
              format_key: formatKey,
              action: "update_content",
              content,
            }),
          });
        } catch {
          // Silently fail; user can retry
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [jobId]
  );

  function handleContentChange(formatKey: string, newContent: string) {
    setDerivatives((prev) =>
      prev.map((d) =>
        d.format === formatKey
          ? { ...d, content: newContent, char_count: newContent.length }
          : d
      )
    );
    autoSave(formatKey, newContent);
  }

  async function handleAction(
    formatKey: string,
    action: "approve" | "reject"
  ) {
    try {
      const res = await fetch("/api/repurpose/derivatives", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          format_key: formatKey,
          action,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      setDerivatives(data.derivatives);
      if (data.job_status) setJobStatus(data.job_status);
    } catch {
      // Silently fail
    }
  }

  async function handleRegenerate(formatKey: string) {
    setRegenerating((prev) => ({ ...prev, [formatKey]: true }));

    try {
      await fetch("/api/repurpose/derivatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          format_key: formatKey,
        }),
      });
    } catch {
      setRegenerating((prev) => ({ ...prev, [formatKey]: false }));
    }
  }

  const activeDerivative = derivatives.find((d) => d.format === activeTab);
  const sourceText = sourceTranscript || contentBody || "No source content available.";
  const allApproved = derivatives.length > 0 && derivatives.every(
    (d) => d.status === "approved" || d.status === "rejected"
  );

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/repurpose"
          style={{
            color: "#6b7280",
            fontSize: 14,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          ← Back to queue
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                margin: 0,
                color: "#111827",
              }}
            >
              Review Derivatives
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 14,
                color: "#6b7280",
                maxWidth: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={contentTitle}
            >
              {contentTitle}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saving && (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Saving...</span>
            )}
            {allApproved && (
              <span
                style={{
                  background: "#d1fae5",
                  color: "#065f46",
                  borderRadius: 6,
                  padding: "5px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                All reviewed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-side layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left panel: source content */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
            position: "sticky",
            top: 24,
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #f3f4f6",
              background: "#f9fafb",
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 700,
                margin: 0,
                color: "#374151",
              }}
            >
              Source Content
            </h2>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {contentPlatform} · {sourceText.length.toLocaleString()} characters
            </span>
          </div>
          <div
            style={{
              padding: 20,
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
              fontSize: 14,
              lineHeight: 1.7,
              color: "#374151",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {sourceText}
          </div>
        </div>

        {/* Right panel: derivative tabs + cards */}
        <div>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 16,
              overflowX: "auto",
              paddingBottom: 2,
            }}
          >
            {derivatives.map((d) => {
              const isActive = activeTab === d.format;
              const statusDot =
                d.status === "approved"
                  ? "#10b981"
                  : d.status === "rejected"
                    ? "#ef4444"
                    : "#d1d5db";

              return (
                <button
                  key={d.format}
                  onClick={() => setActiveTab(d.format)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: isActive
                      ? "1.5px solid #2563eb"
                      : "1.5px solid #e5e7eb",
                    background: isActive ? "#eff6ff" : "#fff",
                    color: isActive ? "#1d4ed8" : "#6b7280",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    transition: "all 0.1s",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: statusDot,
                      flexShrink: 0,
                    }}
                  />
                  {FORMAT_LABELS[d.format] ?? d.format}
                </button>
              );
            })}
          </div>

          {/* Active derivative card */}
          {activeDerivative && (
            <DerivativeCard
              derivative={activeDerivative}
              isRegenerating={!!regenerating[activeDerivative.format]}
              onContentChange={(content) =>
                handleContentChange(activeDerivative.format, content)
              }
              onApprove={() => handleAction(activeDerivative.format, "approve")}
              onReject={() => handleAction(activeDerivative.format, "reject")}
              onRegenerate={() => handleRegenerate(activeDerivative.format)}
            />
          )}

          {derivatives.length === 0 && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "40px 20px",
                textAlign: "center",
                color: "#9ca3af",
                background: "#fff",
              }}
            >
              <p style={{ fontSize: 15, margin: "0 0 4px" }}>
                No derivatives generated yet.
              </p>
              <p style={{ fontSize: 13 }}>
                Derivatives will appear here once processing completes.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── DerivativeCard ──────────────────────────────────────────────────────────

function DerivativeCard({
  derivative,
  isRegenerating,
  onContentChange,
  onApprove,
  onReject,
  onRegenerate,
}: {
  derivative: Derivative;
  isRegenerating: boolean;
  onContentChange: (content: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}) {
  const charLimit = PLATFORM_LIMITS[derivative.platform] ?? 2000;
  const isOverLimit = derivative.char_count > charLimit;
  const platformStyle = PLATFORM_COLORS[derivative.platform] ?? {
    bg: "#f3f4f6",
    color: "#374151",
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #f3f4f6",
          background: "#f9fafb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: platformStyle.bg,
              color: platformStyle.color,
              borderRadius: 5,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            {derivative.platform}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            {FORMAT_LABELS[derivative.format] ?? derivative.format}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: isOverLimit ? "#dc2626" : "#6b7280",
              fontWeight: isOverLimit ? 600 : 400,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {derivative.char_count.toLocaleString()} / {charLimit.toLocaleString()}
          </span>
          {derivative.status !== "pending" && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background:
                  derivative.status === "approved" ? "#d1fae5" : "#fee2e2",
                color:
                  derivative.status === "approved" ? "#065f46" : "#991b1b",
              }}
            >
              {derivative.status === "approved" ? "Approved" : "Rejected"}
            </span>
          )}
        </div>
      </div>

      {/* Over-limit warning */}
      {isOverLimit && (
        <div
          style={{
            padding: "8px 20px",
            background: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            fontSize: 12,
            color: "#dc2626",
            fontWeight: 500,
          }}
        >
          Content exceeds {derivative.platform} character limit by{" "}
          {(derivative.char_count - charLimit).toLocaleString()} characters.
        </div>
      )}

      {/* Editable text area */}
      <div style={{ padding: 20 }}>
        {isRegenerating ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <div
              style={{
                display: "inline-block",
                width: 24,
                height: 24,
                border: "3px solid #e5e7eb",
                borderTopColor: "#2563eb",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginBottom: 12,
              }}
            />
            <p style={{ fontSize: 14, margin: 0 }}>Regenerating with Claude...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <textarea
            value={derivative.content}
            onChange={(e) => onContentChange(e.target.value)}
            style={{
              width: "100%",
              minHeight: 280,
              padding: 0,
              border: "none",
              outline: "none",
              resize: "vertical",
              fontSize: 14,
              lineHeight: 1.7,
              color: "#374151",
              fontFamily: "system-ui, sans-serif",
              background: "transparent",
            }}
          />
        )}
      </div>

      {/* Platform preview mock */}
      <div
        style={{
          margin: "0 20px",
          padding: "12px 16px",
          borderRadius: 8,
          background: "#f9fafb",
          border: "1px solid #f3f4f6",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#9ca3af",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Platform Preview
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "#4b5563",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {derivative.content.slice(0, 300)}
          {derivative.content.length > 300 && "..."}
        </div>
      </div>

      {/* Previous drafts */}
      {derivative.previous_drafts.length > 0 && (
        <PreviousDrafts drafts={derivative.previous_drafts} />
      )}

      {/* Action buttons */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          style={{
            padding: "7px 14px",
            borderRadius: 7,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: isRegenerating ? "#9ca3af" : "#374151",
            fontWeight: 500,
            fontSize: 13,
            cursor: isRegenerating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          ↻ Regenerate
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onReject}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "1px solid #fecaca",
              background: derivative.status === "rejected" ? "#fee2e2" : "#fff",
              color: "#dc2626",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              background:
                derivative.status === "approved" ? "#059669" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {derivative.status === "approved" ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PreviousDrafts ──────────────────────────────────────────────────────────

function PreviousDrafts({ drafts }: { drafts: string[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ margin: "0 20px 16px" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: 12,
          color: "#6b7280",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        {expanded ? "▾" : "▸"} Previous drafts ({drafts.length})
      </button>
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {drafts.map((draft, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #f3f4f6",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#6b7280",
                maxHeight: 100,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#9ca3af",
                  marginBottom: 4,
                }}
              >
                Draft {i + 1}
              </div>
              {draft}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
