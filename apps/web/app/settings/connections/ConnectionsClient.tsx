"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import DisconnectButton from "./DisconnectButton";

// ─── Platform config ──────────────────────────────────────────────────────────

interface PlatformConfig {
  label: string;
  color: string;
  connectHref: string;
  description: string;
}

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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConnectionsClient({ creatorId, initialRows }: Props) {
  const [rows, setRows] = useState<ConnectedPlatformRow[]>(initialRows);

  // Subscribe to real-time updates on connected_platforms so the sync
  // progress indicator (and last_synced_at) update without a page refresh.
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

  return (
    <>
      {/* Keyframe injected once — inline styles can't express @keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes meridian-spin { to { transform: rotate(360deg); } }`,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(PLATFORMS).map(([key, cfg]) => {
          const conn = byPlatform[key] ?? null;
          const status = conn?.status ?? "disconnected";
          const isConnected = status !== "disconnected";
          const needsReauth = status === "reauth_required";
          // A platform is syncing when it's active but has never completed a sync.
          // The real-time subscription clears this the moment last_synced_at is stamped.
          const isSyncing = status === "active" && !conn?.last_synced_at;

          return (
            <div
              key={key}
              style={{
                border: `1px solid ${needsReauth ? "#fcd34d" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: 20,
                background: needsReauth ? "#fffdf5" : "#fff",
              }}
            >
              {/* Top row: icon + name + status badge */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: cfg.color,
                    flexShrink: 0,
                  }}
                />

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
                  <DisconnectButton platform={key} platformLabel={cfg.label} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
