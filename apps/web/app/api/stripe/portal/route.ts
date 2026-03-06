import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Billing Portal session and redirects the creator there.
 * The portal lets them update their card, cancel, or download invoices.
 *
 * Return URL: /settings/billing
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
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

  // Look up the creator's Stripe customer ID
  const adminClient = getAdminClient();
  const { data: creator, error: creatorError } = await adminClient
    .from("creators")
    .select("id, stripe_customer_id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const stripeCustomerId = creator.stripe_customer_id as string | null;

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe first." },
      { status: 400 }
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${siteUrl}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
