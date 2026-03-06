import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, tierFromPriceId } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/stripe/webhook
 *
 * Handles both Stripe webhook payload shapes:
 *
 *   • v1 "snapshot" events  (object: "event")
 *     – Full resource embedded in event.data.object
 *     – Verified with STRIPE_WEBHOOK_SECRET via stripe.webhooks.constructEvent()
 *     – Handled: checkout.session.completed, customer.subscription.{updated,deleted}
 *
 *   • v2 "thin" events  (object: "v2.core.event")
 *     – Only a related_object reference is included; full resource fetched on demand
 *     – Verified with STRIPE_V2_WEBHOOK_SECRET via stripe.parseThinEvent()
 *     – Currently acknowledged but not acted on (no v2 subscription events expected)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET       – whsec_… for v1 endpoints
 *   STRIPE_V2_WEBHOOK_SECRET    – whsec_… for v2 endpoints (optional if unused)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 */

export const dynamic = "force-dynamic";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isActiveStatus(status: Stripe.Subscription["status"]): boolean {
  return status === "active" || status === "trialing";
}

function tierFromSubscription(
  subscription: Stripe.Subscription
): "creator" | "pro" | null {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  return tierFromPriceId(priceId);
}

// ─── v1 event handlers ────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!customerId || !subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const tier = tierFromSubscription(subscription);

  if (!tier || !isActiveStatus(subscription.status)) return;

  const { error } = await getAdminClient()
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

  const { error } = await getAdminClient()
    .from("creators")
    .update({
      subscription_tier: newTier,
      stripe_subscription_id: subscription.id,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(
      "[webhook] customer.subscription.updated update failed:",
      error
    );
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { error } = await getAdminClient()
    .from("creators")
    .update({
      subscription_tier: "free",
      stripe_subscription_id: null,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(
      "[webhook] customer.subscription.deleted update failed:",
      error
    );
  }
}

// ─── Payload-format detection ─────────────────────────────────────────────────

/**
 * Peeks at the raw JSON to decide which Stripe payload format was sent.
 * Returns "v2" for thin events (object === "v2.core.event"), "v1" otherwise.
 * Does not validate the signature — that happens inside the parse helpers.
 */
function detectPayloadVersion(rawBody: string): "v1" | "v2" {
  try {
    const parsed = JSON.parse(rawBody) as { object?: string };
    if (parsed.object === "v2.core.event") return "v2";
  } catch {
    // malformed JSON — let the constructEvent call surface the real error
  }
  return "v1";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const version = detectPayloadVersion(body);

  // ── v2 thin payload ──────────────────────────────────────────────────────
  if (version === "v2") {
    const secret = process.env.STRIPE_V2_WEBHOOK_SECRET;
    if (!secret) {
      console.error(
        "[webhook] STRIPE_V2_WEBHOOK_SECRET not set; cannot verify v2 event"
      );
      return NextResponse.json(
        { error: "v2 webhook secret not configured" },
        { status: 500 }
      );
    }

    let thinEvent: ReturnType<typeof stripe.parseThinEvent>;
    try {
      thinEvent = stripe.parseThinEvent(body, sig, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[webhook] v2 signature verification failed:", message);
      return NextResponse.json(
        { error: `Webhook signature error: ${message}` },
        { status: 400 }
      );
    }

    // Fetch the full v2 event object only when we need the resource data.
    // Currently no v2 events require action, but the structure is ready to extend.
    console.log(`[webhook] v2 thin event received and verified: ${thinEvent.type}`);

    return NextResponse.json({ received: true });
  }

  // ── v1 snapshot payload ──────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] v1 signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature error: ${message}` },
      { status: 400 }
    );
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
        // Acknowledge but ignore unhandled v1 event types
        break;
    }
  } catch (err) {
    console.error(`[webhook] error handling v1 event ${event.type}:`, err);
    // Return 200 so Stripe does not retry events that fail due to application bugs
    return NextResponse.json({ error: "Handler error" }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}
