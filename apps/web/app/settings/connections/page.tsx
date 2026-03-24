import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TIER_LIMITS, type SubscriptionTier } from "@/lib/subscription";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  substack: "Substack",
  beehiiv: "Beehiiv",
  twitter: "X (Twitter)",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
};

/**
 * /settings/connections – Account settings overview
 *
 * Shows a compact summary of connected platforms and subscription status.
 * Platform management (connect, disconnect, sync status) lives at /connect.
 */
export default async function ConnectionsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: creator } = await supabase
    .from("creators")
    .select("id, subscription_tier")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) redirect("/login");

  const tier = ((creator.subscription_tier as SubscriptionTier) ?? "free");
  const platformLimit = TIER_LIMITS[tier].platforms;

  const [{ data: connectedRows }, { count: activePlatformCount }] = await Promise.all([
    supabase
      .from("connected_platforms")
      .select("platform, platform_username, status")
      .eq("creator_id", creator.id)
      .neq("status", "disconnected"),
    supabase
      .from("connected_platforms")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", creator.id)
      .neq("status", "disconnected"),
  ]);

  const connected = connectedRows ?? [];
  const activeCount = activePlatformCount ?? 0;
  const limitDisplay = platformLimit === Infinity ? "∞" : String(platformLimit);

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Settings</h1>
      <p style={{ color: "#6b7280", margin: "0 0 40px", fontSize: 15 }}>
        Manage your account preferences and integrations.
      </p>

      {/* ── Platforms section ── */}
      <section style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Platforms</h2>
          <Link
            href="/connect"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#2563eb",
              textDecoration: "none",
              padding: "5px 12px",
              border: "1px solid #bfdbfe",
              borderRadius: 6,
              background: "#eff6ff",
              whiteSpace: "nowrap",
            }}
          >
            Manage connections →
          </Link>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {connected.length === 0 ? (
            <div style={{ padding: "16px 18px", fontSize: 14, color: "#9ca3af" }}>
              No platforms connected yet.{" "}
              <Link href="/connect" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                Connect one →
              </Link>
            </div>
          ) : (
            connected.map((row, i) => {
              const isReauth = row.status === "reauth_required";
              return (
                <div
                  key={row.platform}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 18px",
                    borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                    background: isReauth ? "#fffdf5" : "#fff",
                  }}
                >
                  {/* Status dot */}
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isReauth ? "#f59e0b" : "#16a34a",
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {PLATFORM_LABELS[row.platform] ?? row.platform}
                  </span>
                  {row.platform_username && (
                    <span
                      style={{
                        fontSize: 13,
                        color: "#9ca3af",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.platform_username}
                    </span>
                  )}
                  {isReauth && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#92400e",
                        background: "#fffbeb",
                        padding: "2px 8px",
                        borderRadius: 99,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      Re-auth required
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Subscription section ── */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Subscription</h2>
          <Link
            href="/settings/billing"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#2563eb",
              textDecoration: "none",
              padding: "5px 12px",
              border: "1px solid #bfdbfe",
              borderRadius: 6,
              background: "#eff6ff",
              whiteSpace: "nowrap",
            }}
          >
            Billing &amp; subscription →
          </Link>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: tier === "pro" ? "#faf5ff" : tier === "creator" ? "#eff6ff" : "#f3f4f6",
              color: tier === "pro" ? "#7c3aed" : tier === "creator" ? "#1d4ed8" : "#374151",
              border: `1px solid ${tier === "pro" ? "#e9d5ff" : tier === "creator" ? "#bfdbfe" : "#d1d5db"}`,
              borderRadius: 99,
              padding: "3px 12px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {TIER_LABELS[tier] ?? tier} plan
          </span>
          <span style={{ fontSize: 14, color: "#6b7280" }}>
            {activeCount} / {limitDisplay} platform{activeCount !== 1 ? "s" : ""} connected
          </span>
        </div>
      </section>
    </main>
  );
}
