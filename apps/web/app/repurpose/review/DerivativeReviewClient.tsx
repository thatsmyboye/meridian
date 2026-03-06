"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Derivative {
  format: string;
  content: string;
  platform: string;
  char_count: number;
  status: "pending" | "approved" | "rejected" | "scheduled" | "published" | "failed_publish";
  previous_drafts: string[];
  scheduled_at: string | null;
  schedule_id: string | null;
  published_at: string | null;
  publish_error: string | null;
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

function formatScheduledDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

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
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({});
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
          // Silently fail
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

  async function handleSchedule(formatKey: string, scheduledAt: string) {
    setScheduling((prev) => ({ ...prev, [formatKey]: true }));
    try {
      const res = await fetch("/api/repurpose/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          format_key: formatKey,
          scheduled_at: scheduledAt,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to schedule");
        return;
      }
      const data = await res.json();
      setDerivatives(data.derivatives);
    } catch {
      alert("Failed to schedule");
    } finally {
      setScheduling((prev) => ({ ...prev, [formatKey]: false }));
    }
  }

  async function handleCancelSchedule(formatKey: string) {
    setScheduling((prev) => ({ ...prev, [formatKey]: true }));
    try {
      const res = await fetch("/api/repurpose/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, format_key: formatKey }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to cancel schedule");
        return;
      }
      const data = await res.json();
      setDerivatives(data.derivatives);
    } catch {
      alert("Failed to cancel schedule");
    } finally {
      setScheduling((prev) => ({ ...prev, [formatKey]: false }));
    }
  }

  async function handleReschedule(formatKey: string, newScheduledAt: string) {
    setScheduling((prev) => ({ ...prev, [formatKey]: true }));
    try {
      const res = await fetch("/api/repurpose/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          format_key: formatKey,
          scheduled_at: newScheduledAt,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to reschedule");
        return;
      }
      const data = await res.json();
      setDerivatives(data.derivatives);
    } catch {
      alert("Failed to reschedule");
    } finally {
      setScheduling((prev) => ({ ...prev, [formatKey]: false }));
    }
  }

  const activeDerivative = derivatives.find((d) => d.format === activeTab);
  const sourceText = sourceTranscript || contentBody || "No source content available.";
  const allApproved = derivatives.length > 0 && derivatives.every(
    (d) =>
      d.status === "approved" ||
      d.status === "rejected" ||
      d.status === "scheduled" ||
      d.status === "published"
  );

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px 64px",
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
            <Link
              href="/repurpose/calendar"
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                fontWeight: 500,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              View Calendar
            </Link>
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
                d.status === "published"
                  ? "#8b5cf6"
                  : d.status === "scheduled"
                    ? "#f59e0b"
                    : d.status === "approved"
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
              isScheduling={!!scheduling[activeDerivative.format]}
              onContentChange={(content) =>
                handleContentChange(activeDerivative.format, content)
              }
              onApprove={() => handleAction(activeDerivative.format, "approve")}
              onReject={() => handleAction(activeDerivative.format, "reject")}
              onRegenerate={() => handleRegenerate(activeDerivative.format)}
              onSchedule={(scheduledAt) =>
                handleSchedule(activeDerivative.format, scheduledAt)
              }
              onCancelSchedule={() =>
                handleCancelSchedule(activeDerivative.format)
              }
              onReschedule={(newScheduledAt) =>
                handleReschedule(activeDerivative.format, newScheduledAt)
              }
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
  isScheduling,
  onContentChange,
  onApprove,
  onReject,
  onRegenerate,
  onSchedule,
  onCancelSchedule,
  onReschedule,
}: {
  derivative: Derivative;
  isRegenerating: boolean;
  isScheduling: boolean;
  onContentChange: (content: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onSchedule: (scheduledAt: string) => void;
  onCancelSchedule: () => void;
  onReschedule: (newScheduledAt: string) => void;
}) {
  const charLimit = PLATFORM_LIMITS[derivative.platform] ?? 2000;
  const isOverLimit = derivative.char_count > charLimit;
  const platformStyle = PLATFORM_COLORS[derivative.platform] ?? {
    bg: "#f3f4f6",
    color: "#374151",
  };
  const isScheduled = derivative.status === "scheduled";
  const isPublished = derivative.status === "published";
  const isFailedPublish = derivative.status === "failed_publish";
  const isLocked = isScheduled || isPublished;

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
            <StatusBadge status={derivative.status} />
          )}
        </div>
      </div>

      {/* Scheduled info banner */}
      {isScheduled && derivative.scheduled_at && (
        <div
          style={{
            padding: "10px 20px",
            background: "#fffbeb",
            borderBottom: "1px solid #fde68a",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Scheduled to publish:{" "}
          <strong>{formatScheduledDate(derivative.scheduled_at)}</strong>
        </div>
      )}

      {/* Published info banner */}
      {isPublished && derivative.published_at && (
        <div
          style={{
            padding: "10px 20px",
            background: "#f0fdf4",
            borderBottom: "1px solid #bbf7d0",
            fontSize: 13,
            color: "#14532d",
          }}
        >
          Published: {formatScheduledDate(derivative.published_at)}
        </div>
      )}

      {/* Failed publish banner */}
      {isFailedPublish && derivative.publish_error && (
        <div
          style={{
            padding: "10px 20px",
            background: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          Publish failed: {derivative.publish_error}
        </div>
      )}

      {/* Over-limit warning */}
      {isOverLimit && !isLocked && (
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
            disabled={isLocked}
            style={{
              width: "100%",
              minHeight: 280,
              padding: 0,
              border: "none",
              outline: "none",
              resize: "vertical",
              fontSize: 14,
              lineHeight: 1.7,
              color: isLocked ? "#9ca3af" : "#374151",
              fontFamily: "system-ui, sans-serif",
              background: "transparent",
              cursor: isLocked ? "default" : "text",
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

      {/* Schedule picker — shown when approved */}
      {derivative.status === "approved" && (
        <SchedulePicker
          platform={derivative.platform}
          isScheduling={isScheduling}
          onSchedule={onSchedule}
        />
      )}

      {/* Reschedule/Cancel — shown when scheduled */}
      {isScheduled && (
        <ReschedulePicker
          platform={derivative.platform}
          currentScheduledAt={derivative.scheduled_at!}
          isScheduling={isScheduling}
          onReschedule={onReschedule}
          onCancelSchedule={onCancelSchedule}
        />
      )}

      {/* Failed publish — allow re-approving to reschedule */}
      {isFailedPublish && (
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid #f3f4f6",
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={onApprove}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Re-approve &amp; reschedule
          </button>
        </div>
      )}

      {/* Action buttons — shown when pending/approved/rejected only */}
      {!isLocked && !isFailedPublish && (
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
      )}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; label: string }> = {
    approved: { bg: "#d1fae5", color: "#065f46", label: "Approved" },
    rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
    scheduled: { bg: "#fef3c7", color: "#92400e", label: "Scheduled" },
    published: { bg: "#ede9fe", color: "#5b21b6", label: "Published" },
    failed_publish: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
  };
  const cfg = configs[status];
  if (!cfg) return null;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Optimal time helpers (client-side) ──────────────────────────────────────

interface OptimalTime {
  hour: number;   // UTC hour (0–23)
  label: string;  // formatted in UTC, e.g. "9:00 AM"
}

/** Convert a UTC hour to a local datetime string for datetime-local inputs */
function nextOccurrenceOfUTCHour(utcHour: number): string {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(utcHour, 0, 0, 0);
  // If that time has already passed today (UTC), move to tomorrow
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  // Format for datetime-local (local timezone)
  const offsetMs = target.getTimezoneOffset() * 60000;
  return new Date(target.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** Convert UTC hour label to local timezone display */
function localTimeLabel(utcHour: number): string {
  const target = new Date(Date.UTC(2024, 0, 1, utcHour, 0, 0));
  return target.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── SchedulePicker ──────────────────────────────────────────────────────────

function SchedulePicker({
  platform,
  isScheduling,
  onSchedule,
}: {
  platform: string;
  isScheduling: boolean;
  onSchedule: (scheduledAt: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState("");
  const [suggestedTimes, setSuggestedTimes] = useState<OptimalTime[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  function getDefaultDatetime(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    // Format for datetime-local (local timezone)
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  async function handleOpen() {
    setPickerValue(getDefaultDatetime());
    setShowPicker(true);
    // Fetch optimal times in background
    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `/api/repurpose/optimal-times?platform=${encodeURIComponent(platform)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestedTimes(data.times ?? []);
      }
    } catch {
      // Silently ignore — suggestions are best-effort
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function handleSchedule() {
    if (!pickerValue) return;
    onSchedule(new Date(pickerValue).toISOString());
    setShowPicker(false);
  }

  if (!showPicker) {
    return (
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={handleOpen}
          style={{
            padding: "7px 16px",
            borderRadius: 7,
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            color: "#374151",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          📅 Schedule Publish
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "14px 20px",
        borderTop: "1px solid #f3f4f6",
        background: "#fffbeb",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 10 }}>
        Schedule publish time
      </div>

      {/* AI suggested time chips */}
      {(loadingSuggestions || suggestedTimes.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#8b5cf6",
              }}
            />
            Your audience is most active here
          </div>

          {loadingSuggestions ? (
            <div
              style={{
                fontSize: 12,
                color: "#9ca3af",
                fontStyle: "italic",
              }}
            >
              Analysing your engagement data…
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggestedTimes.map((t, i) => (
                <button
                  key={t.hour}
                  onClick={() => setPickerValue(nextOccurrenceOfUTCHour(t.hour))}
                  title="Click to apply this time"
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: "1.5px solid #c4b5fd",
                    background: "#f5f3ff",
                    color: "#5b21b6",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "background 0.1s",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      background: "#8b5cf6",
                      color: "#fff",
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  {localTimeLabel(t.hour)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="datetime-local"
          value={pickerValue}
          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
          onChange={(e) => setPickerValue(e.target.value)}
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 13,
            color: "#374151",
            background: "#fff",
          }}
        />
        <button
          onClick={handleSchedule}
          disabled={isScheduling || !pickerValue}
          style={{
            padding: "7px 16px",
            borderRadius: 7,
            border: "none",
            background: isScheduling ? "#9ca3af" : "#d97706",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: isScheduling ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isScheduling ? "Scheduling…" : "Confirm"}
        </button>
        <button
          onClick={() => setShowPicker(false)}
          style={{
            padding: "7px 10px",
            borderRadius: 7,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#6b7280",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── ReschedulePicker ─────────────────────────────────────────────────────────

function ReschedulePicker({
  platform,
  currentScheduledAt,
  isScheduling,
  onReschedule,
  onCancelSchedule,
}: {
  platform: string;
  currentScheduledAt: string;
  isScheduling: boolean;
  onReschedule: (newScheduledAt: string) => void;
  onCancelSchedule: () => void;
}) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => {
    const d = new Date(currentScheduledAt);
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  });
  const [suggestedTimes, setSuggestedTimes] = useState<OptimalTime[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  async function handleShowReschedule() {
    setShowReschedule(true);
    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `/api/repurpose/optimal-times?platform=${encodeURIComponent(platform)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestedTimes(data.times ?? []);
      }
    } catch {
      // Best-effort
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function handleReschedule() {
    if (!pickerValue) return;
    onReschedule(new Date(pickerValue).toISOString());
    setShowReschedule(false);
  }

  return (
    <div
      style={{
        padding: "12px 20px",
        borderTop: "1px solid #f3f4f6",
        background: "#fffbeb",
      }}
    >
      {!showReschedule ? (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={handleShowReschedule}
            disabled={isScheduling}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Reschedule
          </button>
          <button
            onClick={onCancelSchedule}
            disabled={isScheduling}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#dc2626",
              fontWeight: 500,
              fontSize: 13,
              cursor: isScheduling ? "not-allowed" : "pointer",
            }}
          >
            {isScheduling ? "Cancelling…" : "Cancel Schedule"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 10 }}>
            Choose new publish time
          </div>

          {/* AI suggested time chips */}
          {(loadingSuggestions || suggestedTimes.length > 0) && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#8b5cf6",
                  }}
                />
                Your audience is most active here
              </div>

              {loadingSuggestions ? (
                <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                  Analysing your engagement data…
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggestedTimes.map((t, i) => (
                    <button
                      key={t.hour}
                      onClick={() => setPickerValue(nextOccurrenceOfUTCHour(t.hour))}
                      title="Click to apply this time"
                      style={{
                        padding: "5px 11px",
                        borderRadius: 20,
                        border: "1.5px solid #c4b5fd",
                        background: "#f5f3ff",
                        color: "#5b21b6",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          background: "#8b5cf6",
                          color: "#fff",
                          borderRadius: "50%",
                          width: 16,
                          height: 16,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      {localTimeLabel(t.hour)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="datetime-local"
              value={pickerValue}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              onChange={(e) => setPickerValue(e.target.value)}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
                color: "#374151",
                background: "#fff",
              }}
            />
            <button
              onClick={handleReschedule}
              disabled={isScheduling || !pickerValue}
              style={{
                padding: "7px 16px",
                borderRadius: 7,
                border: "none",
                background: isScheduling ? "#9ca3af" : "#d97706",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: isScheduling ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isScheduling ? "Updating…" : "Update"}
            </button>
            <button
              onClick={() => setShowReschedule(false)}
              style={{
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#6b7280",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
