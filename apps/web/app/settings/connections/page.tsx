import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { disconnectPlatform } from "./actions";

/**
 * /settings/connections – Platform connection status page
 *
 * Shows every supported platform as a card with:
 *  - Platform icon (coloured indicator), name, and connected account username
 *  - Status badge: Connected | Re-auth required | Disconnected
 *  - Last synced timestamp
 *  - Connect / Reconnect / Disconnect action buttons
 */

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
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { background: string; color: string; label: string }> = {
    active: { background: "#f0fdf4", color: "#15803d", label: "Connected" },
    reauth_required: { background: "#fffbeb", color: "#92400e", label: "Re-auth required" },
    disconnected: { background: "#f3f4f6", color: "#6b7280", label: "Disconnected" },
  };

  const s = styles[status] ?? styles.disconnected;

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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ConnectedPlatformRow {
  platform: string;
  platform_username: string | null;
  status: string;
  last_synced_at: string | null;
}

export default async function ConnectionsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  let connectedRows: ConnectedPlatformRow[] = [];

  if (creator) {
    const { data } = await supabase
      .from("connected_platforms")
      .select("platform, platform_username, status, last_synced_at")
      .eq("creator_id", creator.id)
      .in("platform", Object.keys(PLATFORMS));

    connectedRows = (data ?? []) as ConnectedPlatformRow[];
  }

  // Build a lookup by platform key for O(1) access in render
  const connectionByPlatform = Object.fromEntries(
    connectedRows.map((row) => [row.platform, row])
  );

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>
              Platform connections
            </h1>
            <p style={{ color: "#6b7280", margin: 0, fontSize: 15 }}>
              Manage the accounts Meridian syncs content and analytics from.
            </p>
          </div>
          <Link
            href="/settings/billing"
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 600,
              color: "#2563eb",
              textDecoration: "none",
              padding: "7px 14px",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              background: "#eff6ff",
              whiteSpace: "nowrap",
              marginTop: 4,
            }}
          >
            Billing &amp; subscription →
          </Link>
        </div>
      </div>

      {/* ── Platform cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(PLATFORMS).map(([key, cfg]) => {
          const conn = connectionByPlatform[key] ?? null;
          const status = conn?.status ?? "disconnected";
          const isConnected = status !== "disconnected";
          const needsReauth = status === "reauth_required";

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
              {/* Top row: icon + name + badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                {/* Platform colour dot */}
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 16 }}>
                      {cfg.label}
                    </span>
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

              {/* Last synced row */}
              <div
                style={{
                  fontSize: 13,
                  color: "#9ca3af",
                  marginBottom: 14,
                }}
              >
                {isConnected ? (
                  <>Last synced: {formatRelativeTime(conn?.last_synced_at ?? null)}</>
                ) : (
                  "Not connected"
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Connect / Reconnect */}
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
                  {needsReauth ? "Reconnect" : isConnected ? "Reconnect" : "Connect"}
                </a>

                {/* Disconnect — only shown when connected */}
                {isConnected && (
                  <form
                    action={async () => {
                      "use server";
                      await disconnectPlatform(key);
                    }}
                  >
                    <button
                      type="submit"
                      style={{
                        background: "transparent",
                        color: "#ef4444",
                        padding: "7px 16px",
                        borderRadius: 6,
                        border: "1px solid #fca5a5",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Disconnect
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
