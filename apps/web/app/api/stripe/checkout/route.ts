import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the requested plan and redirects the
 * user to the hosted payment page.
 *
 * Body (JSON):
 *   { "plan": "creator" | "pro" }
 *
 * On success Stripe redirects to:
 *   /dashboard?upgraded=true
 *
 * On cancellation Stripe redirects to:
 *   /settings/billing
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_CREATOR_PRICE_ID
 *   STRIPE_PRO_PRICE_ID
 *   NEXT_PUBLIC_SITE_URL
 */

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: Request) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // Authenticate
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse plan from body
  let plan: string;
  try {
    const body = await request.json();
    plan = body.plan;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const priceId =
    plan === "creator"
      ? process.env.STRIPE_CREATOR_PRICE_ID
      : plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : null;

  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Fetch the creator row to get or create a Stripe customer ID
  const adminClient = getAdminClient();
  const { data: creator, error: creatorError } = await adminClient
    .from("creators")
    .select("id, email, stripe_customer_id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // Reuse existing Stripe customer or create a new one
  let stripeCustomerId: string | null = creator.stripe_customer_id as string | null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: creator.email as string,
      metadata: { creator_id: creator.id as string },
    });
    stripeCustomerId = customer.id;

    // Persist so future checkouts reuse the same customer
    await adminClient
      .from("creators")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", creator.id);
  }

  // Create the hosted Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    customer_update: { address: "auto" },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/dashboard?upgraded=true`,
    cancel_url: `${siteUrl}/settings/billing`,
    subscription_data: {
      metadata: { creator_id: creator.id as string },
    },
  });

  return NextResponse.json({ url: session.url });
}
