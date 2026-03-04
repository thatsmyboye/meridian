"use client";

import type { ContentType } from "@meridian/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { type: ContentType; label: string }[] = [
  { type: "video", label: "Video" },
  { type: "short", label: "Short" },
  { type: "newsletter", label: "Newsletter" },
  { type: "podcast", label: "Podcast" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContentTypeFilterProps {
  selected: ContentType[];
  onChange: (types: ContentType[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContentTypeFilter({
  selected,
  onChange,
}: ContentTypeFilterProps) {
  function toggle(type: ContentType) {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else {
      onChange([...selected, type]);
    }
  }

  return (
    <div
      role="group"
      aria-label="Filter by content type"
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
    >
      {CONTENT_TYPES.map(({ type, label }) => {
        const active = selected.includes(type);
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            aria-pressed={active}
            style={{
              padding: "5px 14px",
              borderRadius: 9999,
              border: "1px solid",
              borderColor: active ? "#2563eb" : "#d1d5db",
              background: active ? "#eff6ff" : "#fff",
              color: active ? "#1d4ed8" : "#374151",
              fontWeight: active ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.1s",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
