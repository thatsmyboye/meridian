"use client";

import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepurposeModalProps {
  contentItemId: string;
  contentTitle: string;
  sourcePlatform: string;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PLATFORMS: { value: string; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "podcast", label: "Podcast" },
  { value: "other", label: "Other" },
];

const DERIVATIVE_FORMATS: { value: string; label: string }[] = [
  { value: "twitter_thread", label: "Twitter / X Thread" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "instagram_caption", label: "Instagram Caption" },
  { value: "newsletter_blurb", label: "Newsletter Blurb" },
  { value: "tiktok_script", label: "TikTok Script" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepurposeModal({
  contentItemId,
  contentTitle,
  sourcePlatform,
  onClose,
  onSuccess,
}: RepurposeModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open the native dialog on mount
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Close on backdrop click
  function handleDialogClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  const targetPlatforms = ALL_PLATFORMS.filter(
    (p) => p.value !== sourcePlatform
  );

  function toggleFormat(value: string) {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedPlatform) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_item_id: contentItemId,
          target_platform: selectedPlatform,
          selected_formats: [...selectedFormats],
        }),
      });

      const data = (await res.json()) as { job_id?: string; error?: string };

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      onSuccess(data.job_id!);
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      style={{
        border: "none",
        borderRadius: 12,
        padding: 0,
        maxWidth: 440,
        width: "calc(100% - 32px)",
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
      }}
    >
      <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Repurpose content
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "#6b7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 310,
              }}
              title={contentTitle}
            >
              {contentTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9ca3af",
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 4px",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Platform selection */}
        <fieldset
          style={{ border: "none", padding: 0, margin: "0 0 20px" }}
        >
          <legend
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 10,
              padding: 0,
            }}
          >
            Select target format
          </legend>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {targetPlatforms.map((p) => {
              const isSelected = selectedPlatform === p.value;
              return (
                <label
                  key={p.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${isSelected ? "#2563eb" : "#e5e7eb"}`,
                    background: isSelected ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "#1d4ed8" : "#374151",
                    transition: "border-color 0.1s, background 0.1s",
                  }}
                >
                  <input
                    type="radio"
                    name="target_platform"
                    value={p.value}
                    checked={isSelected}
                    onChange={() => setSelectedPlatform(p.value)}
                    style={{ accentColor: "#2563eb" }}
                  />
                  {p.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Derivative format selection */}
        <fieldset
          style={{ border: "none", padding: 0, margin: "0 0 20px" }}
        >
          <legend
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 10,
              padding: 0,
            }}
          >
            Select derivative formats
            <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4 }}>
              (optional — all if none selected)
            </span>
          </legend>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {DERIVATIVE_FORMATS.map((f) => {
              const isSelected = selectedFormats.has(f.value);
              return (
                <label
                  key={f.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${isSelected ? "#7c3aed" : "#e5e7eb"}`,
                    background: isSelected ? "#f5f3ff" : "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "#6d28d9" : "#374151",
                    transition: "border-color 0.1s, background 0.1s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFormat(f.value)}
                    style={{ accentColor: "#7c3aed" }}
                  />
                  {f.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Error message */}
        {status === "error" && (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              color: "#dc2626",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "8px 12px",
            }}
          >
            {errorMessage}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedPlatform || status === "loading"}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "none",
              background:
                !selectedPlatform || status === "loading"
                  ? "#93c5fd"
                  : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor:
                !selectedPlatform || status === "loading"
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {status === "loading" ? "Submitting…" : "Start repurposing"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
