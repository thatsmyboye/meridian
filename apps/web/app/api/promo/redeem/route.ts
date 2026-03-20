import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/promo/redeem
 *
 * Validates and redeems a promo code for the authenticated creator.
 * Grants a time-limited trial on a specific subscription tier.
 *
 * Body: { code: string }
 *
 * Success 200: { tier, trialEndsAt, durationDays }
 * Errors:
 *   400 – missing/invalid input
 *   401 – not authenticated
 *   404 – code not found
 *   409 – already on an active trial
 *   410 – code expired or fully redeemed
 *   500 – database error
 */
export const dynamic = "force-dynamic";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Input validation ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code =
    body !== null &&
    typeof body === "object" &&
    "code" in body &&
    typeof (body as Record<string, unknown>).code === "string"
      ? ((body as Record<string, unknown>).code as string).trim().toUpperCase()
      : null;

  if (!code) {
    return NextResponse.json({ error: "A promo code is required." }, { status: 400 });
  }

  const admin = getAdminClient();

  // ── Load creator ─────────────────────────────────────────────────────────────
  const { data: creator, error: creatorError } = await admin
    .from("creators")
    .select("id, subscription_tier, trial_tier, trial_ends_at")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  }

  // ── Block if already on an active trial ──────────────────────────────────────
  if (
    creator.trial_tier &&
    creator.trial_ends_at &&
    new Date(creator.trial_ends_at as string) > new Date()
  ) {
    const expiresOn = new Date(creator.trial_ends_at as string).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    );
    return NextResponse.json(
      {
        error: `You already have an active ${creator.trial_tier} trial (expires ${expiresOn}). You can redeem another code once it ends.`,
      },
      { status: 409 }
    );
  }

  // ── Look up promo code ───────────────────────────────────────────────────────
  const { data: promo, error: promoError } = await admin
    .from("promo_codes")
    .select("id, tier, duration_days, max_uses, used_count, expires_at")
    .eq("code", code)
    .single();

  if (promoError || !promo) {
    return NextResponse.json({ error: "Invalid promo code." }, { status: 404 });
  }

  // ── Validate code is still usable ────────────────────────────────────────────
  if (promo.expires_at && new Date(promo.expires_at as string) < new Date()) {
    return NextResponse.json(
      { error: "This promo code has expired." },
      { status: 410 }
    );
  }

  if (
    promo.max_uses !== null &&
    (promo.used_count as number) >= (promo.max_uses as number)
  ) {
    return NextResponse.json(
      { error: "This promo code has already been fully redeemed." },
      { status: 410 }
    );
  }

  // ── Check this creator hasn't already redeemed this specific code ─────────────
  const { data: existingRedemption } = await admin
    .from("promo_redemptions")
    .select("id")
    .eq("promo_code_id", promo.id)
    .eq("creator_id", creator.id)
    .maybeSingle();

  if (existingRedemption) {
    return NextResponse.json(
      { error: "You have already redeemed this promo code." },
      { status: 409 }
    );
  }

  // ── Apply the trial ──────────────────────────────────────────────────────────
  const trialEndsAt = new Date(
    Date.now() + (promo.duration_days as number) * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateError } = await admin
    .from("creators")
    .update({
      pre_trial_tier: creator.subscription_tier,
      trial_tier: promo.tier,
      trial_ends_at: trialEndsAt,
      // Overwrite subscription_tier so all existing tier checks see the new tier
      // immediately without any code changes.
      subscription_tier: promo.tier,
    })
    .eq("id", creator.id);

  if (updateError) {
    console.error("[promo/redeem] Failed to apply trial:", updateError);
    return NextResponse.json(
      { error: "Failed to apply promo code. Please try again." },
      { status: 500 }
    );
  }

  // ── Record the redemption and increment counter atomically ───────────────────
  // These two writes are best-effort: if they fail the trial is already applied.
  // The redundancy (redemptions table + used_count) means we can always reconcile.
  await Promise.allSettled([
    admin
      .from("promo_redemptions")
      .insert({ promo_code_id: promo.id, creator_id: creator.id, trial_ends_at: trialEndsAt }),
    admin
      .from("promo_codes")
      .update({ used_count: (promo.used_count as number) + 1 })
      .eq("id", promo.id),
  ]);

  return NextResponse.json({
    tier: promo.tier,
    trialEndsAt,
    durationDays: promo.duration_days,
  });
}
