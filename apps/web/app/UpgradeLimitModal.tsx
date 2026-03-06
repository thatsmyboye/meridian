"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LimitKind = "platform" | "repurpose";

interface UpgradeLimitModalProps {
  kind: LimitKind;
  onClose: () => void;
}

// ─── What the Creator plan unlocks ────────────────────────────────────────────

const CREATOR_FEATURES: Record<LimitKind, { headline: string; perks: string[] }> = {
  platform: {
    headline: "You've reached your Free plan limit for connected platforms.",
    perks: [
      "Connect up to 3 platforms (YouTube, Instagram, Beehiiv)",
      "20 repurpose jobs per month",
      "AI pattern insights across all platforms",
      "Priority support",
    ],
  },
  repurpose: {
    headline: "You've used all 5 repurpose jobs on your Free plan this month.",
    perks: [
      "20 repurpose jobs per month",
      "Connect up to 3 platforms",
      "AI pattern insights across all platforms",
      "Priority support",
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function UpgradeLimitModal({
  kind,
  onClose,
}: UpgradeLimitModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { headline, perks } = CREATOR_FEATURES[kind];

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "creator" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      {/* Modal card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            color: "#9ca3af",
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>

        {/* Lock icon */}
        <div
          style={{
            width: 48,
            height: 48,
            background: "#fef3c7",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            marginBottom: 16,
          }}
        >
          🔒
        </div>

        {/* Headline */}
        <h2
          id="upgrade-modal-title"
          style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#111827" }}
        >
          {headline}
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>
          Upgrade to <strong>Creator — $19/month</strong> to unlock:
        </p>

        {/* Perks list */}
        <ul
          style={{
            margin: "0 0 24px",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {perks.map((perk) => (
            <li
              key={perk}
              style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#374151" }}
            >
              <span style={{ color: "#2563eb", fontWeight: 700, flexShrink: 0 }}>✓</span>
              {perk}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "#93c5fd" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 0",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: error ? 12 : 0,
            transition: "background 0.15s",
          }}
        >
          {loading ? "Redirecting to checkout…" : "Upgrade to Creator →"}
        </button>

        {error && (
          <p
            role="alert"
            style={{ color: "#b91c1c", fontSize: 13, margin: "8px 0 0", textAlign: "center" }}
          >
            {error}
          </p>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", margin: "12px 0 0" }}>
          Cancel any time · Billed monthly
        </p>
      </div>
    </div>
  );
}
