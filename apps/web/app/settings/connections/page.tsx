import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TIER_LIMITS, type SubscriptionTier } from "@/lib/subscription";
import ConnectionsClient, { type ConnectedPlatformRow } from "./ConnectionsClient";

/**
 * /settings/connections – Platform connection status page
 *
 * Server component: fetches the creator's connected platforms and passes them
 * to ConnectionsClient, which handles real-time sync-progress updates via a
 * Supabase postgres_changes subscription.
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

  const [{ data }, { count: activePlatformCount }] = await Promise.all([
    supabase
      .from("connected_platforms")
      .select("platform, platform_username, status, last_synced_at")
      .eq("creator_id", creator.id),
    supabase
      .from("connected_platforms")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", creator.id)
      .neq("status", "disconnected"),
  ]);

  const initialRows = (data ?? []) as ConnectedPlatformRow[];

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px 64px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
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

      {/* ── Platform cards (client component — handles real-time sync progress) ── */}
      <ConnectionsClient
        creatorId={creator.id}
        initialRows={initialRows}
        tier={tier}
        activePlatformCount={activePlatformCount ?? 0}
        platformLimit={platformLimit}
      />
    </main>
  );
}
