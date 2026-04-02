import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/patreon/callback
 *
 * Handles the OAuth 2.0 callback from Patreon after the creator grants access.
 * Steps performed:
 *  1. Verify the `state` param matches the CSRF cookie set during initiation.
 *  2. Confirm the creator is still authenticated.
 *  3. Exchange the authorization code for access + refresh tokens.
 *  4. Fetch the creator's Patreon identity (user ID, name) and primary campaign.
 *  5. Encrypt both tokens with AES-256-GCM before persistence.
 *  6. Upsert a row in connected_platforms (idempotent on re-connect).
 *  7. Fire platform/connected event to kick off content sync.
 *  8. Redirect to /connect?success=patreon.
 *
 * Required env vars:
 *   PATREON_CLIENT_ID      – Patreon OAuth client ID
 *   PATREON_CLIENT_SECRET  – Patreon OAuth client secret
 *   TOKEN_ENCRYPTION_KEY   – 64 hex chars (32-byte AES-256 key)
 *   NEXT_PUBLIC_SITE_URL   – Production base URL
 */

const PATREON_API_BASE = "https://www.patreon.com/api/oauth2/v2";

interface PatreonTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface PatreonIdentityResponse {
  data: {
    id: string;
    attributes: {
      full_name: string;
      email?: string;
      thumb_url?: string;
    };
  };
}

interface PatreonCampaignsResponse {
  data: Array<{
    id: string;
    attributes: {
      creation_name: string | null;
      summary: string | null;
      patron_count: number | null;
    };
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access on the Patreon consent screen
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_params`);
  }

  // ── 1. Verify CSRF state cookie ──────────────────────────────────────────
  const storedState = request.cookies.get("patreon_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=state_mismatch`);
  }

  // ── 2. Confirm authenticated creator ────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`);
  }

  // ── 3. Exchange authorization code for tokens ────────────────────────────
  const tokenRes = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: process.env.PATREON_CLIENT_ID!,
      client_secret: process.env.PATREON_CLIENT_SECRET!,
      redirect_uri: `${siteUrl}/api/connect/patreon/callback`,
    }),
  });

  if (!tokenRes.ok) {
    console.error(
      "[patreon/callback] Token exchange failed:",
      await tokenRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const tokens: PatreonTokenResponse = await tokenRes.json();

  // ── 4a. Fetch Patreon identity ───────────────────────────────────────────
  const identityRes = await fetch(
    `${PATREON_API_BASE}/identity?fields[user]=full_name,email,thumb_url`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (!identityRes.ok) {
    console.error(
      "[patreon/callback] Identity fetch failed:",
      await identityRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=identity_fetch_failed`
    );
  }

  const identityData: PatreonIdentityResponse = await identityRes.json();
  const patreonUser = identityData.data;

  // ── 4b. Fetch creator's campaigns ────────────────────────────────────────
  // Creators may have 0 campaigns (plain patrons with no campaign). We treat
  // missing campaigns gracefully — the platform row is still saved so they can
  // reconnect or use the publisher once a campaign exists.
  const campaignsRes = await fetch(
    `${PATREON_API_BASE}/campaigns?fields[campaign]=creation_name,summary,patron_count`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  let primaryCampaignId: string | null = null;
  let primaryCampaignName: string | null = null;

  if (campaignsRes.ok) {
    const campaignsData: PatreonCampaignsResponse = await campaignsRes.json();
    const firstCampaign = campaignsData.data[0];
    if (firstCampaign) {
      primaryCampaignId = firstCampaign.id;
      primaryCampaignName = firstCampaign.attributes.creation_name ?? null;
    }
  } else {
    // Non-fatal: log but continue — the creator may not have a campaign yet.
    console.warn(
      "[patreon/callback] Campaigns fetch failed (non-fatal):",
      await campaignsRes.text()
    );
  }

  // ── 5. Look up the creator row ───────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error(
      "[patreon/callback] Creator lookup failed:",
      creatorErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=creator_not_found`
    );
  }

  // ── 6. Encrypt tokens and upsert connected_platforms ─────────────────────
  let accessTokenEnc: string;
  let refreshTokenEnc: string | null = null;
  try {
    accessTokenEnc = encryptToken(tokens.access_token);
    refreshTokenEnc = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;
  } catch (err) {
    console.error("[patreon/callback] Token encryption failed:", err);
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_encryption_failed`
    );
  }

  const tokenExpiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "patreon",
        platform_user_id: patreonUser.id,
        platform_username: patreonUser.attributes.full_name,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at: tokenExpiresAt,
        scopes: tokens.scope.split(" "),
        status: "active",
        metadata: {
          campaign_id: primaryCampaignId,
          campaign_name: primaryCampaignName,
        },
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error(
      "[patreon/callback] connected_platforms upsert failed:",
      upsertErr?.message
    );
    return NextResponse.redirect(`${siteUrl}/connect?error=save_failed`);
  }

  // ── 7. Fire platform/connected event to kick off content sync ────────────
  try {
    await inngest.send({
      name: "platform/connected",
      data: {
        creator_id: creator.id,
        platform: "patreon",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[patreon/callback] inngest.send failed:", err);
  }

  // ── 8. Clear state cookie and redirect to success ────────────────────────
  const response = NextResponse.redirect(`${siteUrl}/connect?success=patreon`);
  response.cookies.delete("patreon_oauth_state");
  return response;
}
