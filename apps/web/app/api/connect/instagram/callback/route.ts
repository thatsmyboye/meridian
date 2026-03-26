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
 * Webhook verification is handled by the dedicated endpoint:
 *   GET /api/webhooks/instagram
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
  paging?: { next?: string };
}

interface InstagramUserResponse {
  id: string;
  username: string;
}

interface MetaDebugTokenResponse {
  data: {
    is_valid: boolean;
    user_id?: string;
    granular_scopes?: Array<{
      scope: string;
      target_ids?: string[];
    }>;
  };
}
 
// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

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
    const metaError = await shortLivedRes.text();
    console.error(
      "[instagram/callback] Short-lived token exchange failed" +
        ` (HTTP ${shortLivedRes.status}):`,
      metaError,
      `| redirect_uri used: ${siteUrl}/api/connect/instagram/callback`
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
    const metaError = await longLivedRes.text();
    console.error(
      "[instagram/callback] Long-lived token exchange (fb_exchange_token) failed" +
        ` (HTTP ${longLivedRes.status}):`,
      metaError
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
  // Meta paginates /me/accounts at 25 items per page, so we must follow
  // paging.next cursors until we find a linked Instagram account or exhaust all pages.
  //
  // IMPORTANT: instagram_business_account must be queried with the *page's*
  // own access token, not the user access token. When requested via the user
  // token in /me/accounts, Meta silently omits the field even if the account
  // is properly linked. We therefore fetch pages (with their page tokens) first,
  // then re-query each page individually with its page token.
  let pageWithInstagram: MetaPageAccount | undefined;
  let nextUrl: string | undefined =
    `${META_GRAPH_BASE}/me/accounts?fields=id,name,access_token`;
  let totalPages = 0;
  let totalPagesChecked = 0;
  const MAX_PAGE_FETCHES = 10; // safety cap: 10 × 25 = 250 pages

  outer: while (nextUrl && totalPagesChecked < MAX_PAGE_FETCHES) {
    const pagesRes: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${longLivedTokens.access_token}` },
    });

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
    totalPages += pagesData.data.length;
    totalPagesChecked++;

    // Use each page's own access token to query instagram_business_account.
    // This is required because Meta only returns this field reliably when
    // the request is authenticated with a page-scoped token.
    for (const page of pagesData.data) {
      const igFieldRes = await fetch(
        `${META_GRAPH_BASE}/${page.id}?fields=instagram_business_account`,
        { headers: { Authorization: `Bearer ${page.access_token}` } }
      );
      if (!igFieldRes.ok) {
        console.warn(
          `[instagram/callback] instagram_business_account fetch failed for page ${page.id}:`,
          await igFieldRes.text()
        );
        continue;
      }
      const igFieldData = (await igFieldRes.json()) as {
        instagram_business_account?: { id: string };
      };
      if (igFieldData.instagram_business_account?.id) {
        pageWithInstagram = {
          ...page,
          instagram_business_account: igFieldData.instagram_business_account,
        };
        break outer;
      }
    }

    nextUrl = pagesData.paging?.next;
  }

  console.info(
    `[instagram/callback] Scanned ${totalPages} Facebook page(s) across ${totalPagesChecked} API call(s).`,
    pageWithInstagram
      ? `Found Instagram Business Account: ${pageWithInstagram.instagram_business_account!.id}`
      : "No linked Instagram Business Account found."
  );

  // ── 5b. Resolve Instagram profile from one of two methods ────────────────
  //
  // Method 1 (classic): Facebook Pages path — succeeded when pageWithInstagram
  //   was set above. Fetch the username via the IG Business Account ID.
  //
  // Method 2 (fallback): Direct Instagram Accounts API — used when /me/accounts
  //   returned zero pages. Meta's newer Instagram-first OAuth consent flow lets
  //   users select Instagram accounts directly; the resulting User Access Token
  //   may not carry page tokens (if the Facebook user doesn't admin any Pages),
  //   but does expose /me/instagram_accounts for accounts granted during consent.
 
  let igProfile: InstagramUserResponse | undefined;
 
  if (pageWithInstagram?.instagram_business_account?.id) {
    // Method 1 succeeded — fetch username via the IG Business Account ID.
    const igUserId = pageWithInstagram.instagram_business_account.id;
    const igProfileRes = await fetch(
      `${META_GRAPH_BASE}/${igUserId}?fields=id,username`,
      { headers: { Authorization: `Bearer ${longLivedTokens.access_token}` } }
    );
 
      // Method 3: Extract Instagram account ID from token debug_token granular_scopes.
    // In Meta's new Instagram-first OAuth flow, the Instagram account IDs selected
    // during consent are recorded as target_ids for instagram_basic in the token
    // metadata. This works even when the Facebook user has no Page admin role
    // (Method 1 empty) and the account is not linked to the personal FB profile
    // (Method 2 empty).
    if (!igProfile) {
      console.info(
        "[instagram/callback] Trying debug_token granular_scopes (Method 3)."
      );
 
      const appAccessToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
      const debugParams = new URLSearchParams({
        input_token: longLivedTokens.access_token,
        access_token: appAccessToken,
      });
 
      const debugRes = await fetch(
        `${META_GRAPH_BASE}/debug_token?${debugParams.toString()}`
      );
 
      if (debugRes.ok) {
        const debugData: MetaDebugTokenResponse = await debugRes.json();
        const granularScopes = debugData.data?.granular_scopes ?? [];
        const igScope = granularScopes.find((s) => s.scope === "instagram_basic");
        const igId = igScope?.target_ids?.[0];
 
        if (igId) {
          console.info(
            `[instagram/callback] debug_token yielded IG account ID: ${igId}`
          );
          const igProfileRes = await fetch(
            `${META_GRAPH_BASE}/${igId}?fields=id,username`,
            { headers: { Authorization: `Bearer ${longLivedTokens.access_token}` } }
          );
          if (igProfileRes.ok) {
            igProfile = (await igProfileRes.json()) as InstagramUserResponse;
          } else {
            console.warn(
              "[instagram/callback] Profile fetch from debug_token ID failed:",
              await igProfileRes.text()
            );
          }
        } else {
          console.warn(
            "[instagram/callback] debug_token granular_scopes has no instagram_basic target_ids.",
            JSON.stringify(granularScopes)
          );
        }
      } else {
        console.warn(
          "[instagram/callback] debug_token call failed:",
          await debugRes.text()
        );
      }
    }
    }
  
      igProfile = await igProfileRes.json() as InstagramUserResponse;
  } else if (totalPages === 0) {
    // Method 2 — /me/accounts returned nothing. Try the direct Instagram
    // accounts endpoint, which is populated by the new Instagram-first OAuth
    // consent flow even when the Facebook user doesn't admin any Pages.
    console.info(
      "[instagram/callback] /me/accounts returned 0 pages; trying /me/instagram_accounts fallback."
    );
       const igDirectRes = await fetch(
      `${META_GRAPH_BASE}/me/instagram_accounts?fields=id,username`,
      { headers: { Authorization: `Bearer ${longLivedTokens.access_token}` } }
    );
    
    if (igDirectRes.ok) {
      const igDirectData = await igDirectRes.json();
      const firstAccount = igDirectData.data?.[0];
      if (firstAccount?.id) {
        igProfile = firstAccount as InstagramUserResponse;
        console.info(
          `[instagram/callback] Found Instagram account via /me/instagram_accounts: ${igProfile.username} (${igProfile.id})`
        );
      } else {
        console.warn(
          "[instagram/callback] /me/instagram_accounts returned no accounts.",
          JSON.stringify(igDirectData)
        );
      }
    } else {
      console.warn(
        "[instagram/callback] /me/instagram_accounts fallback failed:",
        await igDirectRes.text()
      );
    }
  }

  if (!igProfile) {
    // Both methods failed — emit the most specific error available.
    const errorCode =
      totalPages === 0
        ? "no_facebook_pages_granted"
        : "no_instagram_business_account";
    return NextResponse.redirect(`${siteUrl}/connect?error=${errorCode}`);
  }

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
