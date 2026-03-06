import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import BillingClient from "./BillingClient";

/**
 * /settings/billing – Subscription & billing management
 *
 * Server component. Fetches the creator's current subscription tier and
 * Stripe customer status, then hands the data to the client component for
 * interactive upgrade/portal actions.
 */
export default async function BillingPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: creator } = await supabase
    .from("creators")
    .select("subscription_tier, stripe_customer_id")
    .eq("auth_user_id", user.id)
    .single();

  const currentTier =
    (creator?.subscription_tier as "free" | "creator" | "pro" | null) ?? "free";
  const hasStripeCustomer = Boolean(creator?.stripe_customer_id);

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "64px auto",
        padding: "0 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <Link
          href="/settings/connections"
          style={{
            display: "inline-block",
            marginBottom: 20,
            fontSize: 14,
            color: "#6b7280",
            textDecoration: "none",
          }}
        >
          ← Back to Settings
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>
          Billing &amp; subscription
        </h1>
        <p style={{ color: "#6b7280", margin: 0, fontSize: 15 }}>
          Choose a plan that fits your workflow. Cancel any time.
        </p>
      </div>

      <BillingClient
        currentTier={currentTier}
        hasStripeCustomer={hasStripeCustomer}
      />
    </main>
  );
}
