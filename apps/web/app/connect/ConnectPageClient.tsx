"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import DisconnectButton from "@/app/settings/connections/DisconnectButton";
import UpgradeLimitModal from "@/app/UpgradeLimitModal";
import { requestPlatformSync } from "@/app/settings/connections/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnectedPlatformRow {
  platform: string;
  platform_username: string | null;
  status: string;
  last_synced_at: string | null;
  last_sync_count: number | null;
  sync_error: string | null;
}

/** Platforms that have a dedicated content sync function. */
const SYNCABLE_PLATFORMS = new Set(["youtube", "instagram", "beehiiv", "substack"]);

/** Platforms temporarily hidden from the UI (code/sync intact). */
const HIDDEN_PLATFORMS = new Set(["twitter", "linkedin"]);

interface ConnectPageClientProps {
  creatorId: string;
  initialRows: ConnectedPlatformRow[];
  /** Whether error=platform_limit_reached was set in the URL. */
  showLimitModal: boolean;
  /** Creator's current subscription tier. */
  tier: "free" | "creator" | "pro";
  /** Number of active (non-disconnected) platform connections. */
  activePlatformCount: number;
  /** Max platforms for the current tier. */
  platformLimit: number;
  /** Any non-limit error message to show. */
  errorMessage: string | null;
  /** Platform the error originated from (used to show a "Try again" link). */
  errorPlatform: string | null;
  /** Success message to show. */
  successPlatform: string | null;
}

// ─── Platform config ──────────────────────────────────────────────────────────

interface PlatformConfig {
  label: string;
  color: string;
  connectHref: string;
  description: string;
  note: string | null;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  youtube: {
    label: "YouTube",
    color: "#dc2626",
    connectHref: "/api/connect/youtube",
    description: "Import videos and channel analytics",
    note: null,
  },
  instagram: {
    label: "Instagram",
    color: "#7c3aed",
    connectHref: "/api/connect/instagram",
    description: "Import posts and performance insights",
    note: "Requires a Business or Creator account linked to a Facebook Page",
  },
  substack: {
    label: "Substack",
    color: "#FF6719",
    connectHref: "/connect/substack",
    description: "Import newsletter posts from your public RSS feed",
    note: "Only public posts are available",
  },
  beehiiv: {
    label: "Beehiiv",
    color: "#f97316",
    connectHref: "/connect/beehiiv",
    description: "Import newsletter posts and track open rates & clicks",
    note: "Requires a Beehiiv API key and publication ID",
  },
  twitter: {
    label: "X (Twitter)",
    color: "#000000",
    connectHref: "/api/connect/twitter",
    description: "Import tweets and engagement metrics",
    note: null,
  },
  tiktok: {
    label: "TikTok",
    color: "#010101",
    connectHref: "/api/connect/tiktok",
    description: "Import videos and performance analytics",
    note: null,
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0a66c2",
    connectHref: "/api/connect/linkedin",
    description: "Import posts and professional engagement data",
    note: "Post import may not be available — LinkedIn restricted the required permission for new apps in early 2026",
  },
};

// ─── Success messages ─────────────────────────────────────────────────────────

const SUCCESS_MESSAGES: Record<string, string> = {
  youtube: "YouTube connected successfully. Your content will be imported shortly.",
  instagram: "Instagram connected successfully. Your posts will be imported shortly.",
  substack: "Substack connected successfully. Your posts will be imported shortly.",
  beehiiv: "Beehiiv connected successfully. Your newsletter posts will be imported shortly.",
  twitter: "X (Twitter) connected successfully. Your tweets will be imported shortly.",
  tiktok: "TikTok connected successfully. Your videos will be imported shortly.",
  linkedin: "LinkedIn connected successfully. Your posts will be imported shortly.",
};

// ─── Platform icons ───────────────────────────────────────────────────────────
// YouTube uses its official branded logo (required by YouTube API TOS).
// All other platforms use a white icon centred on a brand-colour square.

function PlatformIcon({ id, color }: { id: string; color: string }) {
  if (id === "youtube") {
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
    substack: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
      </svg>
    ),
    beehiiv: (
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    linkedin: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    tiktok: (
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

// ─── Status badge ─────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConnectPageClient({
  creatorId,
  initialRows,
  showLimitModal: initialShowLimitModal,
  tier,
  activePlatformCount,
  platformLimit,
  errorMessage,
  errorPlatform,
  successPlatform,
}: ConnectPageClientProps) {
  const [rows, setRows] = useState<ConnectedPlatformRow[]>(initialRows);
  const [modalOpen, setModalOpen] = useState(initialShowLimitModal);
  // Tracks platforms currently undergoing a manually triggered refresh.
  const [refreshingPlatforms, setRefreshingPlatforms] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  // Safety-net timers: if no realtime UPDATE arrives within 90s, clear the
  // manual refresh spinner so users are never left with a permanently stuck UI.
  const refreshTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Subscribe to real-time updates so the sync spinner, last_synced_at, and
  // last_sync_count update without a page refresh.
  useEffect(() => {
    if (!creatorId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`connected-platforms-connect:${creatorId}`)
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
                    last_sync_count: updated.last_sync_count ?? r.last_sync_count,
                    sync_error: updated.sync_error ?? null,
                  }
                : r
            )
          );
          // Clear the manual refresh spinner and cancel its safety-net timer.
          setRefreshingPlatforms((prev) => {
            if (!prev.has(updated.platform)) return prev;
            const next = new Set(prev);
            next.delete(updated.platform);
            return next;
          });
          const timer = refreshTimers.current.get(updated.platform);
          if (timer !== undefined) {
            clearTimeout(timer);
            refreshTimers.current.delete(updated.platform);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId]);

  // Clear all safety-net timers on unmount.
  useEffect(() => {
    const timers = refreshTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  function handleRefresh(platform: string) {
    setRefreshingPlatforms((prev) => new Set(prev).add(platform));

    // Safety net: if no realtime UPDATE fires within 90s (e.g. Inngest is
    // down), clear the spinner so the user isn't stuck indefinitely.
    const existing = refreshTimers.current.get(platform);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      setRefreshingPlatforms((prev) => {
        const next = new Set(prev);
        next.delete(platform);
        return next;
      });
      refreshTimers.current.delete(platform);
    }, 90_000);
    refreshTimers.current.set(platform, timer);

    startTransition(async () => {
      await requestPlatformSync(platform);
    });
  }

  const byPlatform = Object.fromEntries(rows.map((r) => [r.platform, r]));
  const atLimit = activePlatformCount >= platformLimit;

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px 64px" }}>
      {/* Keyframe for sync spinner */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes meridian-spin { to { transform: rotate(360deg); } }`,
        }}
      />

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
              ? `You've reached your Free plan limit (${activePlatformCount}/${platformLimit} platforms).`
              : `Free plan: ${activePlatformCount}/${platformLimit} platform connected.`}
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

      {/* Success banner */}
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

      {/* Error banner */}
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
          {errorPlatform && PLATFORMS[errorPlatform] && (
            <>
              {" "}
              <a
                href={PLATFORMS[errorPlatform].connectHref}
                style={{ color: "#991b1b", fontWeight: 600, whiteSpace: "nowrap" }}
              >
                Try connecting again →
              </a>
            </>
          )}
        </div>
      )}

      {/* Platform cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(PLATFORMS).filter(([key]) => !HIDDEN_PLATFORMS.has(key)).map(([key, cfg]) => {
          const conn = byPlatform[key] ?? null;
          const status = conn?.status ?? "disconnected";
          const isConnected = status !== "disconnected";
          const needsReauth = status === "reauth_required";
          const isSyncing =
            (status === "active" && !conn?.last_synced_at) ||
            refreshingPlatforms.has(key);
          const hasSyncError = !isSyncing && Boolean(conn?.sync_error);
          const canRefresh = status === "active" && SYNCABLE_PLATFORMS.has(key) && !isSyncing;
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
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <PlatformIcon id={key} color={cfg.color} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{cfg.label}</span>
                    {isConnected && <StatusBadge status={status} />}
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
                  {cfg.note && !conn?.platform_username && (
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      {cfg.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Sync status row — only shown when connected */}
              {isConnected && (
                <div style={{ marginBottom: 14 }}>
                  {isSyncing ? (
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
                  ) : hasSyncError ? (
                    <span
                      role="status"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        color: "#b45309",
                      }}
                    >
                      <span aria-hidden style={{ fontSize: 12 }}>⚠</span>
                      Sync failed
                      {conn?.last_synced_at && (
                        <span style={{ color: "#9ca3af" }}>&middot; {formatRelativeTime(conn.last_synced_at)}</span>
                      )}
                      {SYNCABLE_PLATFORMS.has(key) && (
                        <button
                          onClick={() => handleRefresh(key)}
                          style={{
                            marginLeft: 4,
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#2563eb",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Retry
                        </button>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Last synced: {formatRelativeTime(conn?.last_synced_at ?? null)}
                      {conn?.last_sync_count != null && (
                        <span style={{ marginLeft: 6 }}>
                          &middot; {conn.last_sync_count.toLocaleString()} item{conn.last_sync_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isLocked ? (
                  <button
                    onClick={() => setModalOpen(true)}
                    style={{
                      display: "inline-block",
                      background: "#9ca3af",
                      color: "#fff",
                      padding: "7px 16px",
                      borderRadius: 6,
                      border: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Connect
                  </button>
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

                    {canRefresh && (
                      <button
                        onClick={() => handleRefresh(key)}
                        style={{
                          display: "inline-block",
                          background: "#fff",
                          color: "#374151",
                          padding: "7px 16px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Refresh
                      </button>
                    )}

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
