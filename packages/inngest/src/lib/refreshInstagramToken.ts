import { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@meridian/api";

/**
 * Instagram / Meta token refresh utilities.
 *
 * The OAuth callback uses Facebook Login (`graph.facebook.com`) and the
 * `fb_exchange_token` grant to obtain a long-lived Facebook User Access Token
 * (valid for ~60 days). This is NOT an Instagram Login token, so it must be
 * refreshed via the same `fb_exchange_token` grant on `graph.facebook.com`,
 * NOT via `ig_refresh_token` on `graph.instagram.com` (which only works for
 * tokens obtained through Instagram Login).
 *
 * Strategy:
 *   - If the stored access token still has more than 7 days until expiry,
 *     decrypt and return it as-is.
 *   - If the token expires within 7 days (or expiry is unknown), attempt
 *     to extend it via `GET graph.facebook.com/.../oauth/access_token
 *     ?grant_type=fb_exchange_token` (requires client_id + client_secret).
 *   - On success: persist the new encrypted token and updated expiry.
 *   - On failure: set connected_platforms.status = "reauth_required" so the
 *     dashboard can prompt the creator to reconnect.
 */

const META_GRAPH_VERSION = "v21.0";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformTokenRow {
  id: string;
  access_token_enc: string;
  token_expires_at: string | null;
}

export type TokenRefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string };

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Ensures a valid Instagram access token is available for a connected platform.
 *
 * Checks whether the stored long-lived token is still valid (with a 7-day
 * proactive buffer). If not, attempts to extend it using Meta's
 * `fb_exchange_token` grant on `graph.facebook.com`, which is the correct
 * refresh mechanism for Facebook User Access Tokens issued via Facebook Login.
 */
export async function ensureValidInstagramToken(
  platformRow: PlatformTokenRow,
  supabase: SupabaseClient<any>
): Promise<TokenRefreshResult> {
  // ── 1. Check whether the current access token is still valid ───────────────
  const expiresAt = platformRow.token_expires_at
    ? new Date(platformRow.token_expires_at)
    : null;
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day buffer
  const tokenIsValid = expiresAt !== null && expiresAt > threshold;

  if (tokenIsValid) {
    return {
      ok: true,
      accessToken: decryptToken(platformRow.access_token_enc),
    };
  }

  // ── 2. Token is expired or close to expiry — attempt a refresh ─────────────
  // When expiry is unknown (null), try fb_exchange_token first; it may succeed.
  // Only when we know the token is past its expiry do we skip the attempt.
  if (expiresAt !== null && expiresAt <= new Date()) {
    // Token is already fully expired; the creator must reconnect.
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason:
        "Instagram access token has expired. The creator must reconnect their account.",
    };
  }

  const currentToken = decryptToken(platformRow.access_token_enc);

  // Facebook User Access Tokens (issued via Facebook Login + fb_exchange_token)
  // must be refreshed on graph.facebook.com using the same fb_exchange_token
  // grant, passing client_id and client_secret. The ig_refresh_token endpoint
  // on graph.instagram.com only works for Instagram Login tokens and will
  // return an error for these tokens.
  const refreshUrl = new URL(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`
  );
  refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
  refreshUrl.searchParams.set("client_id", process.env.META_APP_ID!);
  refreshUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  refreshUrl.searchParams.set("fb_exchange_token", currentToken);

  const tokenRes = await fetch(refreshUrl.toString());

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error(
      `[ensureValidInstagramToken] Refresh failed for platform ${platformRow.id}` +
        ` (${tokenRes.status}): ${body}`
    );
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason: `Instagram token refresh rejected by Meta (${tokenRes.status}). Creator must reconnect.`,
    };
  }

  // ── 3. Persist the refreshed token ─────────────────────────────────────────
  const refreshed: { access_token: string; expires_in?: number } =
    await tokenRes.json();
  // Meta may omit expires_in; fallback to 60 days (matches callback route)
  const expiresInSeconds =
    refreshed.expires_in ?? 60 * 24 * 60 * 60;
  const newExpiry = new Date(
    Date.now() + expiresInSeconds * 1000
  ).toISOString();
  const newTokenEnc = encryptToken(refreshed.access_token);

  // Optimistic concurrency: only update if the stored token hasn't changed.
  // If concurrent functions refreshed the token first, the WHERE clause on
  // access_token_enc won't match and we re-read the already-refreshed token.
  const { data: updatedRows, error: updateError } = await supabase
    .from("connected_platforms")
    .update({
      access_token_enc: newTokenEnc,
      token_expires_at: newExpiry,
      status: "active",
    })
    .eq("id", platformRow.id)
    .eq("access_token_enc", platformRow.access_token_enc)
    .select("id");

  if (updateError) {
    // Log but don't fail — we can still use the fresh token for this run.
    console.error(
      `[ensureValidInstagramToken] Failed to persist refreshed token for` +
        ` platform ${platformRow.id}: ${updateError.message}`
    );
    return { ok: true, accessToken: refreshed.access_token };
  }

  if (updatedRows.length === 0) {
    // Another concurrent run already refreshed the token. Re-read from DB.
    const { data: fresh, error: readErr } = await supabase
      .from("connected_platforms")
      .select("access_token_enc")
      .eq("id", platformRow.id)
      .single();

    if (readErr || !fresh) {
      // Fallback: use the token we just obtained from Meta.
      return { ok: true, accessToken: refreshed.access_token };
    }
    return { ok: true, accessToken: decryptToken(fresh.access_token_enc) };
  }

  return { ok: true, accessToken: refreshed.access_token };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function markReauthRequired(
  supabase: SupabaseClient<any>,
  platformId: string
): Promise<void> {
  const { error } = await supabase
    .from("connected_platforms")
    .update({ status: "reauth_required" })
    .eq("id", platformId);

  if (error) {
    console.error(
      `[ensureValidInstagramToken] Failed to set reauth_required for` +
        ` platform ${platformId}: ${error.message}`
    );
  }
}
