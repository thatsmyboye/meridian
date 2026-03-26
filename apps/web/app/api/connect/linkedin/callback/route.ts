import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/linkedin/callback
 *
 * Handles the OAuth 2.0 callback from LinkedIn after the creator grants
 * access. Steps performed:
 *  1. Verify the `state` param matches the CSRF cookie set during initiation.
 *  2. Confirm the creator is still authenticated.
 *  3. Exchange the authorization code for an access token.
 *  4. Fetch the creator's LinkedIn profile (person ID and name) via OpenID Connect.
 *  5. Encrypt the access token with AES-256-GCM before persistence.
 *  6. Upsert a row in connected_platforms (idempotent on re-connect).
 *  7. Fire platform/connected event.
 *  8. Redirect to /connect?success=linkedin.
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID      – LinkedIn OAuth 2.0 client ID
 *   LINKEDIN_CLIENT_SECRET  – LinkedIn OAuth 2.0 client secret
 *   TOKEN_ENCRYPTION_KEY    – 64 hex chars (32-byte AES-256 key)
 *   NEXT_PUBLIC_SITE_URL    – Production base URL
 */

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number; // seconds; typically 5184000 (60 days)
  scope: string;
  token_type: string;
  // LinkedIn does not issue OAuth refresh tokens for the member auth flow
}

// OpenID Connect userinfo endpoint response
interface LinkedInUserInfo {
  sub: string;       // LinkedIn person URN numeric ID
  name: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access on the LinkedIn consent screen
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_params`);
  }

  // ── 1. Verify CSRF state cookie ──────────────────────────────────────────
  const storedState = request.cookies.get("linkedin_oauth_state")?.value;
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

  // ── 3. Exchange authorization code for access token ──────────────────────
  const tokenRes = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${siteUrl}/api/connect/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    }
  );

  if (!tokenRes.ok) {
    console.error(
      "[linkedin/callback] Token exchange failed:",
      await tokenRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const tokens: LinkedInTokenResponse = await tokenRes.json();

  // ── 4. Fetch LinkedIn profile via OpenID Connect userinfo endpoint ────────
  // The `sub` claim is the member's numeric ID used to build the person URN.
  const userInfoRes = await fetch(
    "https://api.linkedin.com/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  if (!userInfoRes.ok) {
    console.error(
      "[linkedin/callback] UserInfo fetch failed:",
      await userInfoRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=user_fetch_failed`
    );
  }

  const userInfo: LinkedInUserInfo = await userInfoRes.json();

  // LinkedIn person URN format: urn:li:person:{id}
  const personUrn = `urn:li:person:${userInfo.sub}`;

  // ── 5. Look up the creator row ───────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error(
      "[linkedin/callback] Creator lookup failed:",
      creatorErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=creator_not_found`
    );
  }

  // ── 6. Encrypt token and upsert connected_platforms ──────────────────────
  // LinkedIn does not issue refresh tokens for the member auth flow.
  // Tokens are valid for 60 days; creators will need to reconnect after expiry.
  const accessTokenEnc = encryptToken(tokens.access_token);
  const tokenExpiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "linkedin",
        platform_user_id: personUrn, // publishToLinkedIn() expects the URN here
        platform_username: userInfo.name,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: null,
        token_expires_at: tokenExpiresAt,
        scopes: ["openid", "profile", "email", "w_member_social", "r_member_social"],
        status: "active",
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error(
      "[linkedin/callback] connected_platforms upsert failed:",
      upsertErr?.message
    );
    return NextResponse.redirect(`${siteUrl}/connect?error=save_failed`);
  }

  // ── 7. Fire platform/connected event ─────────────────────────────────────
  try {
    await inngest.send({
      name: "platform/connected",
      data: {
        creator_id: creator.id,
        platform: "linkedin",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[linkedin/callback] inngest.send failed:", err);
  }

  // ── 8. Clear state cookie and redirect to success ────────────────────────
  const response = NextResponse.redirect(
    `${siteUrl}/connect?success=linkedin`
  );
  response.cookies.delete("linkedin_oauth_state");
  return response;
}
