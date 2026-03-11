import { type NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/instagram/callback
 *
 * Handles the OAuth callback from Meta after the creator grants Instagram
 * access. Steps performed:
 *  1. Verify the `state` param matches the CSRF cookie set during initiation.
 *  2. Confirm the creator is still authenticated.
 *  3. Exchange the short-lived code for a short-lived user access token.
 *  4. Upgrade to a long-lived token (60-day TTL) via fb_exchange_token.
 *  5. Resolve the creator's Instagram Business/Creator Account ID and username.
 *  6. Encrypt the long-lived token before persistence.
 *  7. Upsert a row in connected_platforms (idempotent on re-connect).
 *  8. Fire platform/connected to trigger an immediate content sync.
 *  9. Redirect to /connect?success=instagram.
 *
 * Required env vars:
 *   META_APP_ID            – Meta app ID
 *   META_APP_SECRET        – Meta app secret
 *   TOKEN_ENCRYPTION_KEY   – 64 hex chars (32-byte AES-256 key)
 *   NEXT_PUBLIC_SITE_URL   – Production base URL
 */

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ─── Meta API response types ─────────────────────────────────────────────────

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; // present on long-lived tokens (seconds until expiry)
}

interface MetaPageAccount {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

interface MetaPagesResponse {
  data: MetaPageAccount[];
}

interface InstagramUserResponse {
  id: string;
  username: string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // ── Meta webhook verification challenge ─────────────────────────────────
  // When a webhook callback URL is saved in the Meta App Dashboard, Meta sends
  // a GET request with hub.mode=subscribe, hub.verify_token, and hub.challenge.
  // We must echo back hub.challenge to prove ownership of the endpoint.
  const hubMode = searchParams.get("hub.mode");
  const hubVerifyToken = searchParams.get("hub.verify_token");
  const hubChallenge = searchParams.get("hub.challenge");

  if (hubMode === "subscribe" && hubChallenge !== null) {
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (expectedToken && hubVerifyToken === expectedToken) {
      return new Response(hubChallenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access on the Meta consent screen
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/connect?error=missing_params`);
  }

  // ── 1. Verify CSRF state cookie ──────────────────────────────────────────
  const storedState = request.cookies.get("instagram_oauth_state")?.value;
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

  // ── 3. Exchange code for short-lived user access token ───────────────────
  const shortLivedRes = await fetch(`${META_GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: `${siteUrl}/api/connect/instagram/callback`,
      code,
    }),
  });

  if (!shortLivedRes.ok) {
    console.error(
      "[instagram/callback] Short-lived token exchange failed:",
      await shortLivedRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const shortLivedTokens: MetaTokenResponse = await shortLivedRes.json();

  // ── 4. Upgrade to a long-lived token (60-day TTL) ───────────────────────
  // Meta does not issue OAuth refresh tokens; instead, long-lived tokens are
  // valid for 60 days and can be refreshed before they expire.
  const longLivedParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedTokens.access_token,
  });

  const longLivedRes = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?${longLivedParams.toString()}`
  );

  if (!longLivedRes.ok) {
    console.error(
      "[instagram/callback] Long-lived token exchange failed:",
      await longLivedRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=token_exchange_failed`
    );
  }

  const longLivedTokens: MetaTokenResponse = await longLivedRes.json();
  // Meta returns expires_in in seconds for long-lived tokens (~5184000 = 60 days)
  const tokenExpiresAt = longLivedTokens.expires_in
    ? new Date(Date.now() + longLivedTokens.expires_in * 1000).toISOString()
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // fallback: 60 days

  // ── 5a. Get Facebook Pages with linked Instagram Business Accounts ────────
  // We need pages_show_list scope to enumerate the creator's pages, then
  // read the instagram_business_account field to get the IG user ID.
  const pagesRes = await fetch(
    `${META_GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account`,
    { headers: { Authorization: `Bearer ${longLivedTokens.access_token}` } }
  );

  if (!pagesRes.ok) {
    console.error(
      "[instagram/callback] Pages fetch failed:",
      await pagesRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=instagram_account_fetch_failed`
    );
  }

  const pagesData: MetaPagesResponse = await pagesRes.json();

  // Find the first Page that has a linked Instagram Business Account
  const pageWithInstagram = pagesData.data.find(
    (page) => page.instagram_business_account?.id
  );

  if (!pageWithInstagram?.instagram_business_account?.id) {
    return NextResponse.redirect(
      `${siteUrl}/connect?error=no_instagram_business_account`
    );
  }

  const igUserId = pageWithInstagram.instagram_business_account.id;

  // ── 5b. Fetch Instagram username ─────────────────────────────────────────
  const igProfileRes = await fetch(
    `${META_GRAPH_BASE}/${igUserId}?fields=id,username`,
    { headers: { Authorization: `Bearer ${longLivedTokens.access_token}` } }
  );

  if (!igProfileRes.ok) {
    console.error(
      "[instagram/callback] Instagram profile fetch failed:",
      await igProfileRes.text()
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=instagram_account_fetch_failed`
    );
  }

  const igProfile: InstagramUserResponse = await igProfileRes.json();

  // ── 6. Look up the creator row ───────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error(
      "[instagram/callback] Creator lookup failed:",
      creatorErr?.message
    );
    return NextResponse.redirect(
      `${siteUrl}/connect?error=creator_not_found`
    );
  }

  // ── 7. Encrypt token and upsert connected_platforms ──────────────────────
  // Meta does not issue separate refresh tokens for Instagram. We store the
  // long-lived access token; the background cron refreshes it before expiry.
  const accessTokenEnc = encryptToken(longLivedTokens.access_token);

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "instagram",
        platform_user_id: igProfile.id,
        platform_username: igProfile.username,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: null, // Meta uses token refresh, not a separate refresh token
        token_expires_at: tokenExpiresAt,
        scopes: [
          "instagram_basic",
          "instagram_content_publish",
          "instagram_manage_insights",
          "pages_show_list",
          "pages_read_engagement",
        ],
        status: "active",
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error(
      "[instagram/callback] connected_platforms upsert failed:",
      upsertErr?.message
    );
    return NextResponse.redirect(`${siteUrl}/connect?error=save_failed`);
  }

  // ── 8. Fire platform/connected event to kick off content sync ─────────────
  try {
    await inngest.send({
      name: "platform/connected",
      data: {
        creator_id: creator.id,
        platform: "instagram",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[instagram/callback] inngest.send failed:", err);
  }

  // ── 9. Clear state cookie and redirect to success ────────────────────────
  const response = NextResponse.redirect(
    `${siteUrl}/connect?success=instagram`
  );
  response.cookies.delete("instagram_oauth_state");
  return response;
}
