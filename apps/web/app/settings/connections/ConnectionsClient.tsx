"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import DisconnectButton from "./DisconnectButton";

// ─── Platform config ──────────────────────────────────────────────────────────

interface PlatformConfig {
  label: string;
  color: string;
  connectHref: string;
  description: string;
}

/** Platforms temporarily hidden from the UI (code/sync intact). */
const HIDDEN_PLATFORMS = new Set(["twitter", "linkedin"]);

const PLATFORMS: Record<string, PlatformConfig> = {
  youtube: {
    label: "YouTube",
    color: "#dc2626",
    connectHref: "/api/connect/youtube",
    description: "Videos and channel analytics",
  },
  instagram: {
    label: "Instagram",
    color: "#7c3aed",
    connectHref: "/api/connect/instagram",
    description: "Posts and performance insights",
  },
  beehiiv: {
    label: "Beehiiv",
    color: "#f97316",
    connectHref: "/connect/beehiiv",
    description: "Newsletter posts, open rates and clicks",
  },
  twitter: {
    label: "Twitter / X",
    color: "#000000",
    connectHref: "/api/connect/twitter",
    description: "Publish tweet threads from repurposed content",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0a66c2",
    connectHref: "/api/connect/linkedin",
    description: "Share professional posts with your network",
  },
  tiktok: {
    label: "TikTok",
    color: "#010101",
    connectHref: "/api/connect/tiktok",
    description: "Generate scripts and draft TikTok video posts",
  },
};

// ─── Platform icons ───────────────────────────────────────────────────────────
// YouTube uses its official branded logo (required by YouTube API TOS).
// All other platforms use a white icon centred on a brand-colour square.

function PlatformIcon({ id, color }: { id: string; color: string }) {
  if (id === "youtube") {
    // Official YouTube logo — do not alter colours or proportions
    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* YouTube icon — required by YouTube API Branding Guidelines */}
        <svg height="16" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-label="YouTube" role="img">
          <path
            d="M27.976 3.14A3.514 3.514 0 0 0 25.5.648C23.28 0 14 0 14 0S4.72 0 2.5.648A3.514 3.514 0 0 0 .024 3.14C-.648 5.373 0 10 0 10s-.648 4.627.024 6.86A3.514 3.514 0 0 0 2.5 19.352C4.72 20 14 20 14 20s9.28 0 11.5-.648a3.514 3.514 0 0 0 2.476-2.492C28.648 14.627 28 10 28 10s.648-4.627-.024-6.86z"
            fill="#FF0000"
          />
          <path d="M11.2 14.286 18.4 10l-7.2-4.286v8.572z" fill="#fff" />
        </svg>
      </div>
    );
  }

  const icons: Record<string, React.ReactNode> = {
    instagram: (
      // Camera outline
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2" />
      </svg>
    ),
    beehiiv: (
      // Envelope / mail
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline points="22,6 12,13 2,6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    twitter: (
      // X letterform
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    linkedin: (
      // LinkedIn "in" mark
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    tiktok: (
      // TikTok logo mark
      <svg width="18" height="20" viewBox="0 0 448 512" fill="white" aria-hidden>
        <path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14z" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icons[id] ?? null}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { background: string; color: string; label: string }> = {
    active: { background: "#f0fdf4", color: "#15803d", label: "Connected" },
    reauth_required: { background: "#fffbeb", color: "#92400e", label: "Re-auth required" },
    disconnected: { background: "#f3f4f6", color: "#6b7280", label: "Disconnected" },
  };

  const s = map[status] ?? map.disconnected;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        background: s.background,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnectedPlatformRow {
  platform: string;
  platform_username: string | null;
  status: string;
  last_synced_at: string | null;
}

interface Props {
  creatorId: string;
  initialRows: ConnectedPlatformRow[];
  tier: "free" | "creator" | "pro";
  /** Number of active (non-disconnected) platform connections. */
  activePlatformCount: number;
  /** Max platforms allowed on the current tier (pass 999 for Infinity). */
  platformLimit: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConnectionsClient({
  creatorId,
  initialRows,
  tier,
  activePlatformCount,
  platformLimit,
}: Props) {
  const [rows, setRows] = useState<ConnectedPlatformRow[]>(initialRows);

  // Subscribe to real-time updates so the sync spinner and last_synced_at
  // update without a page refresh.
  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`connected-platforms:${creatorId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "connected_platforms",
          filter: `creator_id=eq.${creatorId}`,
        },
        (payload) => {
          const updated = payload.new as ConnectedPlatformRow;
          setRows((prev) =>
            prev.map((r) =>
              r.platform === updated.platform
                ? {
                    platform: updated.platform,
                    platform_username: updated.platform_username ?? r.platform_username,
                    status: updated.status,
                    last_synced_at: updated.last_synced_at,
                  }
                : r
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId]);

  const byPlatform = Object.fromEntries(rows.map((r) => [r.platform, r]));
  const atLimit = activePlatformCount >= platformLimit;

  return (
    <>
      {/* Keyframe for sync spinner — inline styles can't express @keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes meridian-spin { to { transform: rotate(360deg); } }`,
        }}
      />

      {/* Tier limit banner — only shown for free-tier users who are at capacity */}
      {tier === "free" && atLimit && (
        <div
          style={{
            background: "#fefce8",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>
            You&apos;ve reached your Free plan limit ({activePlatformCount}/{platformLimit} platform).
          </span>
          <Link
            href="/settings/billing"
            style={{
              background: "#2563eb",
              color: "#fff",
              borderRadius: 6,
              padding: "5px 12px",
              fontWeight: 600,
              fontSize: 12,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Platform cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(PLATFORMS).filter(([key]) => !HIDDEN_PLATFORMS.has(key)).map(([key, cfg]) => {
          const conn = byPlatform[key] ?? null;
          const status = conn?.status ?? "disconnected";
          const isConnected = status !== "disconnected";
          const needsReauth = status === "reauth_required";
          const isSyncing = status === "active" && !conn?.last_synced_at;
          // Gray out platforms the user can't connect on their current tier
          const isLocked = atLimit && !isConnected;

          return (
            <div
              key={key}
              style={{
                border: `1px solid ${needsReauth ? "#fcd34d" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: 20,
                background: needsReauth ? "#fffdf5" : "#fff",
                opacity: isLocked ? 0.6 : 1,
              }}
            >
              {/* Top row: icon + name + status badge */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
              >
                <PlatformIcon id={key} color={cfg.color} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{cfg.label}</span>
                    <StatusBadge status={status} />
                  </div>

                  {conn?.platform_username ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conn.platform_username}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                      {cfg.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Sync status row */}
              <div style={{ marginBottom: 14 }}>
                {!isConnected ? (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>Not connected</span>
                ) : isSyncing ? (
                  <span
                    role="status"
                    aria-label="Syncing content"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        border: "2px solid #d1d5db",
                        borderTopColor: "#6b7280",
                        borderRadius: "50%",
                        animation: "meridian-spin 0.75s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                    Syncing content…
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>
                    Last synced: {formatRelativeTime(conn?.last_synced_at ?? null)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isLocked ? (
                  // At tier limit and not connected — direct to billing instead
                  <Link
                    href="/settings/billing"
                    style={{
                      display: "inline-block",
                      background: "#9ca3af",
                      color: "#fff",
                      padding: "7px 16px",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Connect
                  </Link>
                ) : (
                  <>
                    <a
                      href={cfg.connectHref}
                      style={{
                        display: "inline-block",
                        background: isConnected ? "#f3f4f6" : cfg.color,
                        color: isConnected ? "#374151" : "#fff",
                        padding: "7px 16px",
                        borderRadius: 6,
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {needsReauth || isConnected ? "Reconnect" : "Connect"}
                    </a>

                    {isConnected && (
                      <DisconnectButton
                        platform={key}
                        platformLabel={cfg.label}
                        onDisconnect={() =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.platform === key ? { ...r, status: "disconnected" } : r
                            )
                          )
                        }
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* YouTube API attribution — required by YouTube API Branding Guidelines */}
      <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
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
    </>
  );
}
