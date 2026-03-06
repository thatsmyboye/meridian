import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, tierFromPriceId } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events and keeps the `creators` table in sync
 * with the customer's subscription state.
 *
 * Handled events:
 *   checkout.session.completed      – new subscription started
 *   customer.subscription.updated   – plan change, renewal, status change
 *   customer.subscription.deleted   – cancellation / non-renewal
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET      – whsec_… from the Stripe dashboard (or CLI)
 *   SUPABASE_SERVICE_ROLE_KEY  – bypasses RLS so the webhook can update any row
 *   NEXT_PUBLIC_SUPABASE_URL
 */

// Disable Next.js body parsing – Stripe needs the raw bytes for signature verification.
export const dynamic = "force-dynamic";

/**
 * Service-role Supabase client.  Created lazily so the module can still be
 * imported in environments where the env vars are not set (e.g. type-checking).
 */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Maps a Stripe subscription status to a subscription_tier value.
 * Only "active" and "trialing" subscriptions count as paid.
 */
function isActiveStatus(status: Stripe.Subscription["status"]): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Resolves the tier from the first item in a subscription's line items.
 * Returns null when the price ID is unrecognised.
 */
function tierFromSubscription(
  subscription: Stripe.Subscription
): "creator" | "pro" | null {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  return tierFromPriceId(priceId);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!customerId || !subscriptionId) return;

  // Fetch the full subscription to get the price / tier
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const tier = tierFromSubscription(subscription);

  if (!tier || !isActiveStatus(subscription.status)) return;

  const supabase = getAdminClient();

  // Upsert by stripe_customer_id so we handle both:
  //   (a) existing creators whose stripe_customer_id was pre-set, and
  //   (b) new checkouts where we write customer + subscription IDs together.
  const { error } = await supabase
    .from("creators")
    .update({
      subscription_tier: tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[webhook] checkout.session.completed update failed:", error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const tier = tierFromSubscription(subscription);
  const newTier: "free" | "creator" | "pro" =
    tier && isActiveStatus(subscription.status) ? tier : "free";

  const supabase = getAdminClient();

  const { error } = await supabase
    .from("creators")
    .update({
      subscription_tier: newTier,
      stripe_subscription_id: subscription.id,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[webhook] customer.subscription.updated update failed:", error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const supabase = getAdminClient();

  const { error } = await supabase
    .from("creators")
    .update({
      subscription_tier: "free",
      stripe_subscription_id: null,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[webhook] customer.subscription.deleted update failed:", error);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Webhook signature error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      default:
        // Acknowledge but ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`[webhook] error handling event ${event.type}:`, err);
    // Return 200 so Stripe does not retry events that fail due to application bugs
    return NextResponse.json({ error: "Handler error" }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}
