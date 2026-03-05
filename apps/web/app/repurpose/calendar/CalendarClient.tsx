"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarItem {
  jobId: string;
  formatKey: string;
  platform: string;
  formatLabel: string;
  content: string;
  scheduledAt: string;
  status: "scheduled" | "published" | "failed_publish";
  publishedAt: string | null;
  publishError: string | null;
  sourceTitle: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  twitter: { bg: "#e8f5fd", color: "#1d9bf0", dot: "#1d9bf0" },
  linkedin: { bg: "#e8f0fe", color: "#0a66c2", dot: "#0a66c2" },
  instagram: { bg: "#fce7f3", color: "#e1306c", dot: "#e1306c" },
  newsletter: { bg: "#f0fdf4", color: "#16a34a", dot: "#16a34a" },
  tiktok: { bg: "#f0f0f0", color: "#000000", dot: "#555" },
  other: { bg: "#f0fdf4", color: "#16a34a", dot: "#16a34a" },
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  scheduled: { bg: "#fef3c7", color: "#92400e", label: "Scheduled" },
  published: { bg: "#ede9fe", color: "#5b21b6", label: "Published" },
  failed_publish: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const groups = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const dateKey = new Date(item.scheduledAt).toDateString();
    const group = groups.get(dateKey) ?? [];
    group.push(item);
    groups.set(dateKey, group);
  }
  return groups;
}

// ─── CalendarClient ────────────────────────────────────────────────────────────

export default function CalendarClient({ items: initialItems }: { items: CalendarItem[] }) {
  const [items, setItems] = useState<CalendarItem[]>(initialItems);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [reschedulingKey, setReschedulingKey] = useState<string | null>(null);
  const [rescheduleInput, setRescheduleInput] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "scheduled" | "published" | "failed_publish">(
    "all"
  );

  const filteredItems = filter === "all"
    ? items
    : items.filter((i) => i.status === filter);

  // Sort by scheduled_at ascending
  const sorted = [...filteredItems].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const grouped = groupByDate(sorted);

  async function handleCancel(item: CalendarItem) {
    const key = `${item.jobId}:${item.formatKey}`;
    setCancellingKey(key);
    try {
      const res = await fetch("/api/repurpose/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: item.jobId, format_key: item.formatKey }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to cancel");
        return;
      }
      // Remove from calendar list (it goes back to approved)
      setItems((prev) => prev.filter(
        (i) => !(i.jobId === item.jobId && i.formatKey === item.formatKey)
      ));
    } catch {
      alert("Failed to cancel schedule");
    } finally {
      setCancellingKey(null);
    }
  }

  async function handleReschedule(item: CalendarItem) {
    const key = `${item.jobId}:${item.formatKey}`;
    const newDateValue = rescheduleInput[key];
    if (!newDateValue) return;

    setReschedulingKey(key);
    try {
      const res = await fetch("/api/repurpose/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: item.jobId,
          format_key: item.formatKey,
          scheduled_at: new Date(newDateValue).toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to reschedule");
        return;
      }
      const data = await res.json();
      // Update local state with new scheduled_at
      setItems((prev) =>
        prev.map((i) => {
          if (i.jobId === item.jobId && i.formatKey === item.formatKey) {
            return { ...i, scheduledAt: data.scheduled_at };
          }
          return i;
        })
      );
      // Close the reschedule input
      setRescheduleInput((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch {
      alert("Failed to reschedule");
    } finally {
      setReschedulingKey(null);
    }
  }

  const upcoming = items.filter((i) => i.status === "scheduled").length;
  const published = items.filter((i) => i.status === "published").length;
  const failed = items.filter((i) => i.status === "failed_publish").length;

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "40px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
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
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#111827" }}>
              Content Calendar
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
              All scheduled and published derivatives
            </p>
          </div>

          {/* Stats chips */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 4 }}>
            {upcoming > 0 && (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {upcoming} upcoming
              </span>
            )}
            {published > 0 && (
              <span
                style={{
                  background: "#ede9fe",
                  color: "#5b21b6",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {published} published
              </span>
            )}
            {failed > 0 && (
              <span
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {failed} failed
              </span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 20 }}>
          {(["all", "scheduled", "published", "failed_publish"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: filter === f ? "1.5px solid #2563eb" : "1.5px solid #e5e7eb",
                background: filter === f ? "#eff6ff" : "#fff",
                color: filter === f ? "#1d4ed8" : "#6b7280",
                fontWeight: filter === f ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {f === "all"
                ? "All"
                : f === "scheduled"
                  ? "Upcoming"
                  : f === "published"
                    ? "Published"
                    : "Failed"}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#9ca3af",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <p style={{ fontSize: 16, margin: "0 0 6px" }}>No scheduled content yet.</p>
          <p style={{ fontSize: 14, margin: "0 0 20px" }}>
            Approve a derivative and click &ldquo;Schedule Publish&rdquo; to add it here.
          </p>
          <Link
            href="/repurpose"
            style={{
              display: "inline-block",
              padding: "9px 18px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Go to Repurpose Queue
          </Link>
        </div>
      )}

      {/* Grouped calendar items */}
      {Array.from(grouped.entries()).map(([dateKey, dayItems]) => (
        <div key={dateKey} style={{ marginBottom: 32 }}>
          {/* Date header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#374151",
                margin: 0,
                whiteSpace: "nowrap",
              }}
            >
              {formatDate(dayItems[0].scheduledAt)}
            </h2>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "#e5e7eb",
              }}
            />
            <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>
              {dayItems.length} {dayItems.length === 1 ? "post" : "posts"}
            </span>
          </div>

          {/* Items for this day */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayItems.map((item) => {
              const key = `${item.jobId}:${item.formatKey}`;
              const isCancelling = cancellingKey === key;
              const isRescheduling = reschedulingKey === key;
              const showRescheduleInput = rescheduleInput[key] !== undefined;
              const platformStyle = PLATFORM_COLORS[item.platform] ?? PLATFORM_COLORS.other;
              const statusCfg = STATUS_CONFIG[item.status];
              const isScheduled = item.status === "scheduled";

              return (
                <div
                  key={key}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#fff",
                    overflow: "hidden",
                  }}
                >
                  {/* Item header row */}
                  <div
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    {/* Time */}
                    <div
                      style={{
                        minWidth: 90,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatTime(item.scheduledAt)}
                    </div>

                    {/* Platform badge */}
                    <span
                      style={{
                        background: platformStyle.bg,
                        color: platformStyle.color,
                        borderRadius: 5,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "capitalize",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.platform === "other" ? "Newsletter" : item.platform}
                    </span>

                    {/* Format label */}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", flex: 1 }}>
                      {item.formatLabel}
                    </span>

                    {/* Status badge */}
                    {statusCfg && (
                      <span
                        style={{
                          background: statusCfg.bg,
                          color: statusCfg.color,
                          borderRadius: 5,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {statusCfg.label}
                      </span>
                    )}

                    {/* View job link */}
                    <Link
                      href={`/repurpose/review?job_id=${item.jobId}`}
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View →
                    </Link>
                  </div>

                  {/* Content preview + source */}
                  <div style={{ padding: "10px 16px" }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9ca3af",
                        marginBottom: 4,
                      }}
                    >
                      From: {item.sourceTitle}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#4b5563",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 60,
                        overflowY: "hidden",
                        maskImage: "linear-gradient(to bottom, black 60%, transparent)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)",
                      }}
                    >
                      {item.content}
                    </div>
                  </div>

                  {/* Failed error message */}
                  {item.status === "failed_publish" && item.publishError && (
                    <div
                      style={{
                        padding: "8px 16px",
                        background: "#fef2f2",
                        borderTop: "1px solid #fecaca",
                        fontSize: 12,
                        color: "#991b1b",
                      }}
                    >
                      Error: {item.publishError}
                    </div>
                  )}

                  {/* Cancel / Reschedule actions (scheduled only) */}
                  {isScheduled && (
                    <div
                      style={{
                        padding: "10px 16px",
                        borderTop: "1px solid #f3f4f6",
                        background: "#fffbeb",
                      }}
                    >
                      {!showRescheduleInput ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            onClick={() =>
                              setRescheduleInput((prev) => ({
                                ...prev,
                                [key]: new Date(item.scheduledAt).toISOString().slice(0, 16),
                              }))
                            }
                            style={{
                              padding: "5px 12px",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              background: "#fff",
                              color: "#374151",
                              fontWeight: 500,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancel(item)}
                            disabled={isCancelling}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 6,
                              border: "1px solid #fecaca",
                              background: "#fff",
                              color: "#dc2626",
                              fontWeight: 500,
                              fontSize: 12,
                              cursor: isCancelling ? "not-allowed" : "pointer",
                            }}
                          >
                            {isCancelling ? "Cancelling…" : "Cancel"}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="datetime-local"
                            value={rescheduleInput[key]}
                            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            onChange={(e) =>
                              setRescheduleInput((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            style={{
                              flex: 1,
                              padding: "5px 8px",
                              borderRadius: 5,
                              border: "1px solid #d1d5db",
                              fontSize: 12,
                              color: "#374151",
                              background: "#fff",
                            }}
                          />
                          <button
                            onClick={() => handleReschedule(item)}
                            disabled={isRescheduling}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 6,
                              border: "none",
                              background: isRescheduling ? "#9ca3af" : "#d97706",
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: isRescheduling ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isRescheduling ? "Saving…" : "Update"}
                          </button>
                          <button
                            onClick={() =>
                              setRescheduleInput((prev) => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              })
                            }
                            style={{
                              padding: "5px 8px",
                              borderRadius: 6,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              color: "#6b7280",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </main>
  );
}
