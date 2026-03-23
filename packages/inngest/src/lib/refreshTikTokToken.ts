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
 * Ensures a valid TikTok access token is available for a connected platform.
 *
 * TikTok access tokens expire (typically 24 hours). The OAuth callback stores
 * a refresh token which can be used to obtain a new access token without
 * requiring the creator to re-authenticate. TikTok refresh tokens are valid
 * for up to 365 days.
 *
 * On success:
 *   - Persists the new encrypted access token, updated refresh token, and
 *     updated expiry to connected_platforms.
 *   - Sets status back to "active".
 *   - Returns { ok: true, accessToken }.
 *
 * On failure (no refresh token, or TikTok rejects the refresh):
 *   - Sets connected_platforms.status = "reauth_required" so the dashboard
 *     can surface a re-auth prompt to the creator.
 *   - Returns { ok: false, reason }.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY    – TikTok app client key
 *   TIKTOK_CLIENT_SECRET – TikTok app client secret
 */
export async function ensureValidTikTokToken(
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
        "No refresh token stored. The creator must reconnect their TikTok account.",
    };
  }

  const refreshToken = decryptToken(platformRow.refresh_token_enc);

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error(
      `[ensureValidTikTokToken] Refresh failed for platform ${platformRow.id}` +
        ` (${tokenRes.status}): ${body}`
    );
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason: `TikTok token refresh rejected (${tokenRes.status}). Creator must reconnect.`,
    };
  }

  // ── 3. Persist the new access token and refresh token ───────────────────────
  const tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    refresh_expires_in?: number;
  } = await tokenRes.json();

  const newExpiry = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();
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
      token_expires_at: newExpiry,
      status: "active",
    })
    .eq("id", platformRow.id)
    .eq("access_token_enc", platformRow.access_token_enc)
    .select("id");

  if (updateError) {
    // Log but don't fail — we can still use the fresh token for this run.
    console.error(
      `[ensureValidTikTokToken] Failed to persist refreshed token for` +
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
      `[ensureValidTikTokToken] Failed to set reauth_required for` +
        ` platform ${platformId}: ${error.message}`
    );
  }
}
