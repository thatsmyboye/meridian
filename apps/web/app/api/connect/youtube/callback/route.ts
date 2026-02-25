import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/youtube/callback
 *
 * Handles the OAuth callback from Google after the creator grants YouTube
 * access. Steps performed:
 *  1. Verify the `state` param matches the CSRF cookie set during initiation.
 *  2. Confirm the creator is still authenticated.
 *  3. Exchange the authorization code for access + refresh tokens.
 *  4. Fetch the creator's YouTube channel metadata (ID and display name).
 *  5. Encrypt both tokens with AES-256-GCM before persistence.
 *  6. Upsert a row in connected_platforms (idempotent on re-connect).
 *  7. Redirect to /connect?success=youtube.
 *
 * Required env vars:
 *   YOUTUBE_CLIENT_ID      – Google OAuth client ID
 *   YOUTUBE_CLIENT_SECRET  – Google OAuth client secret
 *   TOKEN_ENCRYPTION_KEY   – 64 hex chars (32-byte AES-256 key)
 *   NEXT_PUBLIC_SITE_URL   – Production base URL
 */

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface YouTubeChannelListResponse {
  items?: Array<{
    id: string;
    snippet: { title: string };
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access on the Google consent screen
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_params`);
  }

  // ── 1. Verify CSRF state cookie ──────────────────────────────────────────
  const storedState = request.cookies.get("youtube_oauth_state")?.value;
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
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: `${siteUrl}/api/connect/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error(
      "[youtube/callback] Token exchange failed:",
      await tokenRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const tokens: GoogleTokenResponse = await tokenRes.json();

  // ── 4. Fetch YouTube channel info ────────────────────────────────────────
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (!channelRes.ok) {
    console.error(
      "[youtube/callback] Channel fetch failed:",
      await channelRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=channel_fetch_failed`
    );
  }

  const channelData: YouTubeChannelListResponse = await channelRes.json();
  const channel = channelData.items?.[0];

  if (!channel) {
    // Google account has no associated YouTube channel
    return NextResponse.redirect(`${siteUrl}/connect?error=no_youtube_channel`);
  }

  // ── 5. Look up the creator row ───────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error("[youtube/callback] Creator lookup failed:", creatorErr?.message);
    return NextResponse.redirect(
      `${siteUrl}/connect?error=creator_not_found`
    );
  }

  // ── 6. Encrypt tokens and upsert connected_platforms ─────────────────────
  const accessTokenEnc = encryptToken(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : null;
  const tokenExpiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "youtube",
        platform_user_id: channel.id,
        platform_username: channel.snippet.title,
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
      "[youtube/callback] connected_platforms upsert failed:",
      upsertErr?.message
    );
    return NextResponse.redirect(`${siteUrl}/connect?error=save_failed`);
  }

  // ── 7. Fire platform/connected event to kick off content sync ────────────
  await inngest.send({
    name: "platform/connected",
    data: {
      creator_id: creator.id,
      platform: "youtube",
      connected_platform_id: platformData.id,
    },
  });

  // ── 8. Clear state cookie and redirect to success ────────────────────────
  const response = NextResponse.redirect(`${siteUrl}/connect?success=youtube`);
  response.cookies.delete("youtube_oauth_state");
  return response;
}
