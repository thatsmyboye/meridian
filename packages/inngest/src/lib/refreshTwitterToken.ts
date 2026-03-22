import { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@meridian/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformTokenRow {
  id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
}

export type TokenRefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string };

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Ensures a valid Twitter/X access token is available for a connected platform.
 *
 * Twitter OAuth 2.0 access tokens expire (typically within 2 hours for user
 * auth tokens). With the `offline.access` scope the callback also stores a
 * refresh token. Twitter uses rotating refresh tokens — each successful
 * refresh invalidates the previous refresh token and issues a new one, so
 * BOTH tokens must be persisted after every refresh.
 *
 * On success:
 *   - Persists the new encrypted access token, rotated refresh token, and
 *     updated expiry to connected_platforms.
 *   - Sets status back to "active".
 *   - Returns { ok: true, accessToken }.
 *
 * On failure (no refresh token, or Twitter rejects the refresh):
 *   - Sets connected_platforms.status = "reauth_required" so the dashboard
 *     can surface a re-auth prompt to the creator.
 *   - Returns { ok: false, reason }.
 *
 * Required env vars:
 *   TWITTER_CLIENT_ID     – Twitter OAuth 2.0 client ID
 *   TWITTER_CLIENT_SECRET – Twitter OAuth 2.0 client secret
 */
export async function ensureValidTwitterToken(
  platformRow: PlatformTokenRow,
  supabase: SupabaseClient<any>
): Promise<TokenRefreshResult> {
  // ── 1. Check whether the current access token is still valid ───────────────
  const expiresAt = platformRow.token_expires_at
    ? new Date(platformRow.token_expires_at)
    : null;
  // Treat the token as expired if it expires within the next 5 minutes.
  const threshold = new Date(Date.now() + 5 * 60 * 1000);
  const tokenIsValid = expiresAt !== null && expiresAt > threshold;

  if (tokenIsValid) {
    return { ok: true, accessToken: decryptToken(platformRow.access_token_enc) };
  }

  // ── 2. Token is expired — attempt a refresh ─────────────────────────────────
  if (!platformRow.refresh_token_enc) {
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason:
        "No refresh token stored. The creator must reconnect their X (Twitter) account.",
    };
  }

  const refreshToken = decryptToken(platformRow.refresh_token_enc);

  // Twitter requires Basic auth (client_id:client_secret) for confidential
  // clients when exchanging a refresh token.
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
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error(
      `[ensureValidTwitterToken] Refresh failed for platform ${platformRow.id}` +
        ` (${tokenRes.status}): ${body}`
    );
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason: `Twitter token refresh rejected (${tokenRes.status}). Creator must reconnect.`,
    };
  }

  // ── 3. Persist the new access token and rotated refresh token ───────────────
  // Twitter rotates refresh tokens on every use — the old refresh token is
  // immediately invalidated. Both tokens must be updated atomically.
  const tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  } = await tokenRes.json();

  const newExpiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;
  const newAccessTokenEnc = encryptToken(tokens.access_token);
  const newRefreshTokenEnc = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : null;

  // Optimistic concurrency: only update if the stored token hasn't changed.
  const { data: updatedRows, error: updateError } = await supabase
    .from("connected_platforms")
    .update({
      access_token_enc: newAccessTokenEnc,
      ...(newRefreshTokenEnc ? { refresh_token_enc: newRefreshTokenEnc } : {}),
      ...(newExpiry ? { token_expires_at: newExpiry } : {}),
      status: "active",
    })
    .eq("id", platformRow.id)
    .eq("access_token_enc", platformRow.access_token_enc)
    .select("id");

  if (updateError) {
    // Log but don't fail — we can still use the fresh token for this run.
    console.error(
      `[ensureValidTwitterToken] Failed to persist refreshed token for` +
        ` platform ${platformRow.id}: ${updateError.message}`
    );
    return { ok: true, accessToken: tokens.access_token };
  }

  if (updatedRows.length === 0) {
    // Another concurrent run already refreshed the token. Re-read from DB.
    const { data: fresh, error: readErr } = await supabase
      .from("connected_platforms")
      .select("access_token_enc")
      .eq("id", platformRow.id)
      .single();

    if (readErr || !fresh) {
      return { ok: true, accessToken: tokens.access_token };
    }
    return { ok: true, accessToken: decryptToken(fresh.access_token_enc) };
  }

  return { ok: true, accessToken: tokens.access_token };
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
      `[ensureValidTwitterToken] Failed to set reauth_required for` +
        ` platform ${platformId}: ${error.message}`
    );
  }
}
