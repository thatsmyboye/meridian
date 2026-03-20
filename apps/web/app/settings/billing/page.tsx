import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { TIER_LIMITS } from "@/lib/subscription";
import BillingClient from "./BillingClient";

/**
 * /settings/billing – Subscription & billing management
 *
 * Server component. Fetches:
 *  - Creator's current subscription tier & Stripe IDs
 *  - Next billing date from Stripe (paid plans only)
 *  - Repurpose job usage for the current calendar month
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
    .select("id, subscription_tier, stripe_customer_id, stripe_subscription_id, trial_ends_at")
    .eq("auth_user_id", user.id)
    .single();

  const currentTier =
    (creator?.subscription_tier as "free" | "creator" | "pro" | null) ?? "free";
  const hasStripeCustomer = Boolean(creator?.stripe_customer_id);

  // Active trial — only expose the expiry if it's in the future.
  const trialEndsAt: string | null = (() => {
    const raw = creator?.trial_ends_at as string | null | undefined;
    if (!raw) return null;
    return new Date(raw) > new Date() ? raw : null;
  })();

  // ── Next billing date from Stripe ──────────────────────────────────────────
  let nextBillingDate: string | null = null;

  if (creator?.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        creator.stripe_subscription_id
      );
      if (
        subscription.status === "active" ||
        subscription.status === "trialing"
      ) {
        nextBillingDate = new Date(
          subscription.current_period_end * 1000
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      // Non-fatal: leave nextBillingDate as null
    }
  }

  // ── Repurpose job usage this month ─────────────────────────────────────────
  let repurposeJobsUsed = 0;

  if (creator?.id) {
    const monthStart = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        1
      )
    ).toISOString();

    const { count } = await supabase
      .from("repurpose_jobs")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creator.id)
      .gte("created_at", monthStart);

    repurposeJobsUsed = count ?? 0;
  }

  const tierLimits = TIER_LIMITS[currentTier];
  const repurposeJobsLimit =
    tierLimits.repurposeJobsPerMonth === Infinity
      ? null
      : tierLimits.repurposeJobsPerMonth;

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 24px 64px",
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
        repurposeJobsUsed={repurposeJobsUsed}
        repurposeJobsLimit={repurposeJobsLimit}
        nextBillingDate={nextBillingDate}
        trialEndsAt={trialEndsAt}
      />
    </main>
  );
}
