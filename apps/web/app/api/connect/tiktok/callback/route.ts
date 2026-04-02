import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/tiktok/callback
 *
 * Handles the OAuth 2.0 callback from TikTok after the creator grants access.
 * Steps performed:
 *  1. Verify the `state` param matches the CSRF cookie set during initiation.
 *  2. Confirm the creator is still authenticated.
 *  3. Exchange the authorization code + PKCE verifier for access + refresh tokens.
 *  4. Fetch the creator's TikTok user info (open_id and display_name).
 *  5. Encrypt both tokens with AES-256-GCM before persistence.
 *  6. Upsert a row in connected_platforms (idempotent on re-connect).
 *  7. Fire platform/connected event.
 *  8. Redirect to /connect?success=tiktok.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY      – TikTok app client key
 *   TIKTOK_CLIENT_SECRET   – TikTok app client secret
 *   TOKEN_ENCRYPTION_KEY   – 64 hex chars (32-byte AES-256 key)
 *   NEXT_PUBLIC_SITE_URL   – Production base URL
 */

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  open_id: string;           // TikTok's unique user identifier
  scope: string;
  expires_in: number;        // seconds until access_token expires
  refresh_expires_in: number; // seconds until refresh_token expires
  token_type: string;
}

interface TikTokUserInfoResponse {
  data: {
    user: {
      open_id: string;
      display_name: string;
      avatar_url?: string;
      profile_deep_link?: string;
    };
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Strip any path from the site URL so the redirect_uri exactly matches
  // what is registered in the TikTok Developer Portal (origin only).
  const siteUrl = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  ).origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access on the TikTok consent screen
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_params`);
  }

  // ── 1. Verify CSRF state cookie ──────────────────────────────────────────
  const storedState = request.cookies.get("tiktok_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=state_mismatch`);
  }

  // ── Retrieve PKCE code_verifier ──────────────────────────────────────────
  const codeVerifier = request.cookies.get("tiktok_code_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_verifier`);
  }

  // ── 2. Confirm authenticated creator ────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`);
  }

  // ── 3. Exchange authorization code + PKCE verifier for tokens ───────────
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    console.error("[tiktok/callback] TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET env var is not set");
    return NextResponse.redirect(`${siteUrl}/connect?error=oauth_not_configured`);
  }

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${siteUrl}/api/connect/tiktok/callback`,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    console.error(
      "[tiktok/callback] Token exchange failed:",
      await tokenRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const tokens: TikTokTokenResponse = await tokenRes.json();

  // ── 4. Fetch TikTok user info ─────────────────────────────────────────────
  const userInfoRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,profile_deep_link",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  if (!userInfoRes.ok) {
    console.error(
      "[tiktok/callback] User info fetch failed:",
      await userInfoRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=user_fetch_failed`
    );
  }

  const userInfoData: TikTokUserInfoResponse = await userInfoRes.json();

  if (userInfoData.error?.code && userInfoData.error.code !== "ok") {
    console.error(
      "[tiktok/callback] User info API error:",
      userInfoData.error.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=user_fetch_failed`
    );
  }

  const tiktokUser = userInfoData.data.user;

  // ── 5. Look up the creator row ───────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error(
      "[tiktok/callback] Creator lookup failed:",
      creatorErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=creator_not_found`
    );
  }

  // ── 6. Encrypt tokens and upsert connected_platforms ─────────────────────
  const accessTokenEnc = encryptToken(tokens.access_token);
  const refreshTokenEnc = encryptToken(tokens.refresh_token);
  const tokenExpiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "tiktok",
        platform_user_id: tiktokUser.open_id,
        platform_username: tiktokUser.display_name,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at: tokenExpiresAt,
        scopes: tokens.scope.split(","),
        status: "active",
        metadata: tiktokUser.profile_deep_link
          ? { profile_deep_link: tiktokUser.profile_deep_link }
          : null,
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error(
      "[tiktok/callback] connected_platforms upsert failed:",
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
        platform: "tiktok",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[tiktok/callback] inngest.send failed:", err);
  }

  // ── 8. Clear state + verifier cookies and redirect to success ─────────────
  const response = NextResponse.redirect(`${siteUrl}/connect?success=tiktok`);
  response.cookies.delete("tiktok_oauth_state");
  response.cookies.delete("tiktok_code_verifier");
  return response;
}
