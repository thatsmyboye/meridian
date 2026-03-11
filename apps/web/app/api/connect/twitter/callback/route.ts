import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/twitter/callback
 *
 * Handles the OAuth 2.0 callback from Twitter/X after the creator grants
 * access. Steps performed:
 *  1. Verify the `state` param matches the CSRF cookie set during initiation.
 *  2. Confirm the creator is still authenticated.
 *  3. Exchange the authorization code + PKCE verifier for access + refresh tokens.
 *  4. Fetch the creator's Twitter user info (ID and username).
 *  5. Encrypt both tokens with AES-256-GCM before persistence.
 *  6. Upsert a row in connected_platforms (idempotent on re-connect).
 *  7. Fire platform/connected event.
 *  8. Redirect to /connect?success=twitter.
 *
 * Required env vars:
 *   TWITTER_CLIENT_ID      – Twitter OAuth 2.0 client ID
 *   TWITTER_CLIENT_SECRET  – Twitter OAuth 2.0 client secret
 *   TOKEN_ENCRYPTION_KEY   – 64 hex chars (32-byte AES-256 key)
 *   NEXT_PUBLIC_SITE_URL   – Production base URL
 */

interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
  token_type: string;
}

interface TwitterUserResponse {
  data: {
    id: string;
    name: string;
    username: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access on the Twitter consent screen
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_params`);
  }

  // ── 1. Verify CSRF state cookie ──────────────────────────────────────────
  const storedState = request.cookies.get("twitter_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=state_mismatch`);
  }

  // ── Retrieve PKCE code_verifier ──────────────────────────────────────────
  const codeVerifier = request.cookies.get("twitter_code_verifier")?.value;
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
  // Twitter requires Basic auth with client credentials for confidential clients.
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: `${siteUrl}/api/connect/twitter/callback`,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    console.error(
      "[twitter/callback] Token exchange failed:",
      await tokenRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const tokens: TwitterTokenResponse = await tokenRes.json();

  // ── 4. Fetch Twitter user info ───────────────────────────────────────────
  const userRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=id,name,username",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  if (!userRes.ok) {
    console.error(
      "[twitter/callback] User fetch failed:",
      await userRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=user_fetch_failed`
    );
  }

  const userData: TwitterUserResponse = await userRes.json();
  const twitterUser = userData.data;

  // ── 5. Look up the creator row ───────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error(
      "[twitter/callback] Creator lookup failed:",
      creatorErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=creator_not_found`
    );
  }

  // ── 6. Encrypt tokens and upsert connected_platforms ─────────────────────
  const accessTokenEnc = encryptToken(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : null;
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "twitter",
        platform_user_id: twitterUser.id,
        platform_username: `@${twitterUser.username}`,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at: tokenExpiresAt,
        scopes: tokens.scope.split(" "),
        status: "active",
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error(
      "[twitter/callback] connected_platforms upsert failed:",
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
        platform: "twitter",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[twitter/callback] inngest.send failed:", err);
  }

  // ── 8. Clear state + verifier cookies and redirect to success ─────────────
  const response = NextResponse.redirect(`${siteUrl}/connect?success=twitter`);
  response.cookies.delete("twitter_oauth_state");
  response.cookies.delete("twitter_code_verifier");
  return response;
}
