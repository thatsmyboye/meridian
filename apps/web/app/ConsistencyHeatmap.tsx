"use client";

import { useMemo, useState } from "react";
import { PLATFORM_COLORS } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentItem {
  contentId: string;
  title: string;
  platform: string;
  publishedAt: string;
}

interface DayData {
  date: string; // YYYY-MM-DD
  count: number;
  items: ContentItem[];
  isFuture: boolean;
}

interface ConsistencyHeatmapProps {
  content: ContentItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_SIZE = 13;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;

// Intensity levels: 0 = empty, 1 = light … 4 = dark
const LEVEL_COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const LEVEL_LABELS = ["None", "1–2", "3–5", "6–9", "10+"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsistencyHeatmap({ content }: ConsistencyHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Group content items by local date
  const dayMap = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of content) {
      // published_at is an ISO string; use the date portion in local time
      const d = new Date(item.publishedAt);
      const dateStr = toLocalDateString(d);
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(item);
    }
    return map;
  }, [content]);

  // Build the 52-week grid (columns = weeks, rows = 0..6 = Sun..Sat)
  // weeks    – chronological order (oldest first), used for streak/stats
  // displayWeeks – reversed (most recent first/left), used for rendering
  const { weeks, displayWeeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateString(today);

    // Start from 52 weeks ago, then rewind to the nearest Sunday
    const startDate = new Date(today.getTime() - 52 * 7 * 86_400_000);
    const dow = startDate.getDay(); // 0 = Sunday
    startDate.setDate(startDate.getDate() - dow);

    const weeks: DayData[][] = [];

    const cursor = new Date(startDate);
    while (cursor <= today) {
      const week: DayData[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = toLocalDateString(cursor);
        const items = dayMap.get(dateStr) ?? [];
        week.push({
          date: dateStr,
          count: items.length,
          items,
          isFuture: dateStr > todayStr,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    // Reverse for display: most recent week on the left, older weeks trail off right
    const displayWeeks = [...weeks].reverse();

    // Build month labels for the reversed display order (newest → oldest).
    // Use the latest day of each week (Saturday, index 6) to determine which
    // month a week belongs to as we traverse newest-first.
    const monthLabels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    let lastLabelWeekIndex = -Infinity;
    const MIN_LABEL_GAP_WEEKS = 3; // ~48px at CELL_STEP=16, wider than any 3-char label
    for (let i = 0; i < displayWeeks.length; i++) {
      const m = new Date(displayWeeks[i][6].date + "T00:00:00").getMonth();
      if (m !== lastMonth) {
        if (i - lastLabelWeekIndex >= MIN_LABEL_GAP_WEEKS) {
          monthLabels.push({ weekIndex: i, label: MONTH_NAMES[m] });
          lastLabelWeekIndex = i;
        }
        lastMonth = m;
      }
    }

    return { weeks, displayWeeks, monthLabels };
  }, [dayMap]);

  const totalPublished = useMemo(() => content.length, [content]);

  const activeDays = useMemo(
    () => weeks.flat().filter((d) => !d.isFuture && d.count > 0).length,
    [weeks],
  );

  const longestStreak = useMemo(() => {
    const flat = weeks.flat().filter((d) => !d.isFuture);
    let best = 0;
    let cur = 0;
    for (const day of flat) {
      if (day.count > 0) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }, [weeks]);

  const gridWidth = displayWeeks.length * CELL_STEP;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Publishing consistency
        </h2>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Last 52 weeks</span>
      </div>

      {/* ── Summary strip ── */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 20,
        }}
      >
        <StatChip label="Pieces published" value={totalPublished} />
        <StatChip label="Active days" value={activeDays} />
        <StatChip label="Longest streak" value={`${longestStreak}d`} />
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ overflowX: "hidden" }}>
        <div style={{ display: "inline-block", position: "relative" }}>
          {/* Month labels */}
          <div
            style={{
              position: "relative",
              height: 18,
              marginBottom: 4,
              width: gridWidth,
            }}
          >
            {monthLabels.map(({ weekIndex, label }) => (
              <span
                key={`${weekIndex}-${label}`}
                style={{
                  position: "absolute",
                  left: weekIndex * CELL_STEP,
                  fontSize: 11,
                  color: "#6b7280",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 0 }}>
            {/* Day-of-week labels */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: CELL_GAP,
                marginRight: 6,
                paddingTop: 0,
              }}
            >
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  style={{
                    height: CELL_SIZE,
                    fontSize: 10,
                    color: "#9ca3af",
                    lineHeight: `${CELL_SIZE}px`,
                    // Only show Mon, Wed, Fri to avoid crowding
                    visibility: i === 1 || i === 3 || i === 5 ? "visible" : "hidden",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div style={{ display: "flex", gap: CELL_GAP }}>
              {displayWeeks.map((week, wi) => (
                <div
                  key={wi}
                  style={{ display: "flex", flexDirection: "column", gap: CELL_GAP }}
                >
                  {week.map((day) => {
                    const level = day.isFuture ? -1 : getLevel(day.count);
                    const isHovered = hoveredDate === day.date;
                    const isSelected = selectedDay?.date === day.date;
                    const bg =
                      day.isFuture
                        ? "transparent"
                        : LEVEL_COLORS[level];

                    return (
                      <div
                        key={day.date}
                        title={
                          day.isFuture
                            ? undefined
                            : day.count === 0
                            ? formatDisplayDate(day.date)
                            : `${formatDisplayDate(day.date)}: ${day.count} piece${day.count !== 1 ? "s" : ""}`
                        }
                        onClick={() => {
                          if (!day.isFuture) {
                            setSelectedDay(
                              selectedDay?.date === day.date ? null : day,
                            );
                          }
                        }}
                        onMouseEnter={() => setHoveredDate(day.date)}
                        onMouseLeave={() => setHoveredDate(null)}
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          borderRadius: 3,
                          background: bg,
                          border: isSelected
                            ? "2px solid #2563eb"
                            : isHovered && !day.isFuture
                            ? "2px solid #9ca3af"
                            : "2px solid transparent",
                          cursor: day.isFuture ? "default" : "pointer",
                          boxSizing: "border-box",
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              justifyContent: "flex-end",
            }}
          >
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Less</span>
            {LEVEL_COLORS.map((color, i) => (
              <div
                key={i}
                title={LEVEL_LABELS[i]}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 3,
                  background: color,
                }}
              />
            ))}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>More</span>
          </div>
        </div>
      </div>

      {/* ── Day detail panel ── */}
      {selectedDay && (
        <DayDetailPanel
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ─── StatChip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

// ─── DayDetailPanel ──────────────────────────────────────────────────────────

function DayDetailPanel({
  day,
  onClose,
}: {
  day: DayData;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "16px 18px",
        background: "#f9fafb",
        position: "relative",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          color: "#9ca3af",
          padding: 4,
        }}
      >
        ×
      </button>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        {formatDisplayDate(day.date)}
      </div>

      {day.count === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
          Nothing published on this day.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {day.items.map((item) => (
            <a
              key={item.contentId}
              href={`/content/${item.contentId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                color: "inherit",
                padding: "8px 12px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: PLATFORM_COLORS[item.platform] ?? "#6b7280",
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                {item.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  textTransform: "capitalize",
                  whiteSpace: "nowrap",
                }}
              >
                {capitalize(item.platform)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
