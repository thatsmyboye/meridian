"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PLATFORMS: { value: string; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "beehiiv", label: "Beehiiv" },
  { value: "substack", label: "Substack" },
  { value: "tiktok", label: "TikTok" },
  { value: "patreon", label: "Patreon" },
];

const DERIVATIVE_FORMATS: { value: string; label: string }[] = [
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "instagram_caption", label: "Instagram Caption" },
  { value: "newsletter_blurb", label: "Newsletter Blurb" },
  { value: "tiktok_script", label: "TikTok Script" },
  { value: "podcast_script", label: "Podcast Script" },
  { value: "podcast_show_notes", label: "Podcast Show Notes" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewTextImportPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function clearError() {
    if (status === "error") setStatus("idle");
  }

  function toggleFormat(value: string) {
    clearError();
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
    if (!title.trim() || !body.trim() || !selectedPlatform) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/repurpose/text-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
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

      router.push(`/repurpose/review?job_id=${data.job_id}`);
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    selectedPlatform !== "" &&
    status !== "loading";

  return (
    <main
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: "0 0 4px",
            color: "#111827",
          }}
        >
          Repurpose from text
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
          Paste a newsletter, blog post, or any text to generate derivative
          content across platforms.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="title"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
            }}
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); clearError(); }}
            placeholder="e.g. My Weekly Newsletter – Issue #42"
            maxLength={300}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 14,
              color: "#111827",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Body text */}
        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="body"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
            }}
          >
            Content
            <span
              style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4 }}
            >
              (paste your newsletter, blog post, or article)
            </span>
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => { setBody(e.target.value); clearError(); }}
            placeholder="Paste your text here…"
            rows={14}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 14,
              color: "#111827",
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          {body.length > 0 && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#9ca3af",
                textAlign: "right",
              }}
            >
              {body.length.toLocaleString()} characters
            </p>
          )}
        </div>

        {/* Target platform */}
        <fieldset
          style={{ border: "none", padding: 0, margin: "0 0 24px" }}
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
            Target platform
          </legend>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
            }}
          >
            {ALL_PLATFORMS.map((p) => {
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
                    onChange={() => { setSelectedPlatform(p.value); clearError(); }}
                    style={{ accentColor: "#2563eb" }}
                  />
                  {p.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Derivative formats */}
        <fieldset
          style={{ border: "none", padding: 0, margin: "0 0 28px" }}
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
            Derivative formats
            <span
              style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4 }}
            >
              (optional — all if none selected)
            </span>
          </legend>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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

        {/* Error */}
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
          <Link
            href="/repurpose"
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontWeight: 500,
              fontSize: 14,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "9px 20px",
              borderRadius: 7,
              border: "none",
              background: canSubmit ? "#2563eb" : "#93c5fd",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {status === "loading" ? "Submitting…" : "Start repurposing"}
          </button>
        </div>
      </form>
    </main>
  );
}
