"use client";

import { useState } from "react";
import UpgradeLimitModal from "@/app/UpgradeLimitModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectedPlatformRow {
  platform: string;
}

interface ConnectPageClientProps {
  /** Whether error=platform_limit_reached was set in the URL. */
  showLimitModal: boolean;
  /** Creator's current subscription tier. */
  tier: "free" | "creator" | "pro";
  /** Number of platforms already connected. */
  platformCount: number;
  /** Max platforms for the current tier. */
  platformLimit: number;
  /** Already-connected platforms (so we can label buttons "Reconnect"). */
  connectedPlatforms: ConnectedPlatformRow[];
  /** Any non-limit error message to show. */
  errorMessage: string | null;
  /** Success message to show. */
  successPlatform: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUCCESS_MESSAGES: Record<string, string> = {
  youtube: "YouTube connected successfully. Your content will be imported shortly.",
  instagram: "Instagram connected successfully. Your posts will be imported shortly.",
  beehiiv: "Beehiiv connected successfully. Your newsletter posts will be imported shortly.",
};

// ─── Connect button ───────────────────────────────────────────────────────────

function ConnectButton({
  label,
  href,
  color,
  isConnected,
  atLimit,
  onLimitClick,
}: {
  label: string;
  href: string;
  color: string;
  isConnected: boolean;
  atLimit: boolean;
  onLimitClick: () => void;
}) {
  const buttonLabel = isConnected ? "Reconnect" : "Connect";

  // If already connected, reconnect is always allowed (upsert, not a new row)
  if (atLimit && !isConnected) {
    return (
      <button
        onClick={onLimitClick}
        style={{
          display: "inline-block",
          background: "#6b7280",
          color: "#fff",
          padding: "8px 18px",
          borderRadius: 6,
          border: "none",
          fontWeight: 600,
          fontSize: 14,
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        background: color,
        color: "#fff",
        padding: "8px 18px",
        borderRadius: 6,
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
      }}
    >
      {buttonLabel}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConnectPageClient({
  showLimitModal: initialShowLimitModal,
  tier,
  platformCount,
  platformLimit,
  connectedPlatforms,
  errorMessage,
  successPlatform,
}: ConnectPageClientProps) {
  const [modalOpen, setModalOpen] = useState(initialShowLimitModal);

  const atLimit = platformCount >= platformLimit;
  const connectedSet = new Set(connectedPlatforms.map((p) => p.platform));

  const platforms = [
    {
      id: "youtube",
      label: "YouTube",
      description: "Import videos and channel analytics",
      note: null,
      href: "/api/connect/youtube",
      color: "#dc2626",
    },
    {
      id: "instagram",
      label: "Instagram",
      description: "Import posts and performance insights",
      note: "Requires a Business or Creator account linked to a Facebook Page",
      href: "/api/connect/instagram",
      color: "#7c3aed",
    },
    {
      id: "beehiiv",
      label: "Beehiiv",
      description: "Import newsletter posts and track open rates & clicks",
      note: "Requires a Beehiiv API key and publication ID",
      href: "/connect/beehiiv",
      color: "#f97316",
    },
  ];

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Connect platforms
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Link your accounts so Meridian can import your content and analytics.
      </p>

      {/* Tier / limit banner */}
      {tier === "free" && (
        <div
          style={{
            background: atLimit ? "#fefce8" : "#f0f9ff",
            border: `1px solid ${atLimit ? "#fde68a" : "#bae6fd"}`,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: atLimit ? "#92400e" : "#0c4a6e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>
            {atLimit
              ? `You've reached your Free plan limit (${platformCount}/${platformLimit} platforms).`
              : `Free plan: ${platformCount}/${platformLimit} platform connected.`}
          </span>
          {atLimit && (
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "5px 12px",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Upgrade
            </button>
          )}
        </div>
      )}

      {/* Success banners */}
      {successPlatform && SUCCESS_MESSAGES[successPlatform] && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#166534",
          }}
        >
          {SUCCESS_MESSAGES[successPlatform]}
        </div>
      )}

      {/* Error banners (non-limit errors) */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: "#991b1b",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Platform cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {platforms.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              opacity: atLimit && !connectedSet.has(p.id) ? 0.75 : 1,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontSize: 14, color: "#6b7280" }}>{p.description}</div>
              {p.note && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  {p.note}
                </div>
              )}
            </div>
            <ConnectButton
              label={p.label}
              href={p.href}
              color={p.color}
              isConnected={connectedSet.has(p.id)}
              atLimit={atLimit}
              onLimitClick={() => setModalOpen(true)}
            />
          </div>
        ))}
      </div>

      {/* Upgrade modal */}
      {modalOpen && (
        <UpgradeLimitModal
          kind="platform"
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}
