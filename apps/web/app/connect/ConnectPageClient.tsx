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
  substack: "Substack connected successfully. Your posts will be imported shortly.",
  beehiiv: "Beehiiv connected successfully. Your newsletter posts will be imported shortly.",
  twitter: "X (Twitter) connected successfully. Your tweets will be imported shortly.",
  tiktok: "TikTok connected successfully. Your videos will be imported shortly.",
  linkedin: "LinkedIn connected successfully. Your posts will be imported shortly.",
};

// ─── Connect button ───────────────────────────────────────────────────────────

function ConnectButton({
  href,
  color,
  isConnected,
  atLimit,
  onLimitClick,
}: {
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
      id: "substack",
      label: "Substack",
      description: "Import newsletter posts from your public RSS feed",
      note: "Only public posts are available — Substack does not offer a developer API",
      href: "/connect/substack",
      color: "#FF6719",
    },
    {
      id: "beehiiv",
      label: "Beehiiv",
      description: "Import newsletter posts and track open rates & clicks",
      note: "Requires a Beehiiv API key and publication ID",
      href: "/connect/beehiiv",
      color: "#f97316",
    },
    {
      id: "twitter",
      label: "X (Twitter)",
      description: "Import tweets and engagement metrics",
      note: null,
      href: "/api/connect/twitter",
      color: "#000000",
    },
    {
      id: "tiktok",
      label: "TikTok",
      description: "Import videos and performance analytics",
      note: null,
      href: "/api/connect/tiktok",
      color: "#010101",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      description: "Import posts and professional engagement data",
      note: null,
      href: "/api/connect/linkedin",
      color: "#0a66c2",
    },
  ];

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "32px 24px 64px",
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {p.id === "youtube" && (
                  /* YouTube icon — required by YouTube API Branding Guidelines */
                  <svg
                    height="16"
                    viewBox="0 0 28 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="YouTube"
                    role="img"
                  >
                    <path
                      d="M27.976 3.14A3.514 3.514 0 0 0 25.5.648C23.28 0 14 0 14 0S4.72 0 2.5.648A3.514 3.514 0 0 0 .024 3.14C-.648 5.373 0 10 0 10s-.648 4.627.024 6.86A3.514 3.514 0 0 0 2.5 19.352C4.72 20 14 20 14 20s9.28 0 11.5-.648a3.514 3.514 0 0 0 2.476-2.492C28.648 14.627 28 10 28 10s.648-4.627-.024-6.86z"
                      fill="#FF0000"
                    />
                    <path d="M11.2 14.286 18.4 10l-7.2-4.286v8.572z" fill="#fff" />
                  </svg>
                )}
                <span style={{ fontWeight: 600 }}>{p.label}</span>
              </div>
              <div style={{ fontSize: 14, color: "#6b7280" }}>{p.description}</div>
              {p.note && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  {p.note}
                </div>
              )}
            </div>
            <ConnectButton
              href={p.href}
              color={p.color}
              isConnected={connectedSet.has(p.id)}
              atLimit={atLimit}
              onLimitClick={() => setModalOpen(true)}
            />
          </div>
        ))}
      </div>

      {/* YouTube API attribution — required by YouTube API Branding Guidelines */}
      <p
        style={{
          marginTop: 32,
          fontSize: 12,
          color: "#9ca3af",
          textAlign: "center",
        }}
      >
        YouTube features are powered by the YouTube API Services.{" "}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#9ca3af", textDecoration: "underline" }}
        >
          YouTube Terms of Service
        </a>
        .
      </p>

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
