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
 * Ensures a valid Patreon access token is available for a connected platform.
 *
 * Patreon access tokens expire after 31 days (expires_in ≈ 2678400 seconds).
 * A refresh token is issued alongside and can be used to obtain a new access
 * token. Patreon refresh tokens are long-lived (≈ 90 days) and are NOT
 * rotated on use — the same refresh token remains valid until the creator
 * revokes access.
 *
 * On success:
 *   - Persists the new encrypted access token and updated expiry.
 *   - Sets status back to "active".
 *   - Returns { ok: true, accessToken }.
 *
 * On failure (no refresh token, or Patreon rejects the refresh):
 *   - Sets connected_platforms.status = "reauth_required" so the dashboard
 *     can surface a re-auth prompt to the creator.
 *   - Returns { ok: false, reason }.
 *
 * Required env vars:
 *   PATREON_CLIENT_ID     – Patreon OAuth client ID
 *   PATREON_CLIENT_SECRET – Patreon OAuth client secret
 */
export async function ensureValidPatreonToken(
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
        "No refresh token stored. The creator must reconnect their Patreon account.",
    };
  }

  const refreshToken = decryptToken(platformRow.refresh_token_enc);

  // Patreon uses client credentials in the POST body (not Basic Auth).
  const tokenRes = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.PATREON_CLIENT_ID!,
      client_secret: process.env.PATREON_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error(
      `[ensureValidPatreonToken] Refresh failed for platform ${platformRow.id}` +
        ` (${tokenRes.status}): ${body}`
    );
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason: `Patreon token refresh rejected (${tokenRes.status}). Creator must reconnect.`,
    };
  }

  // ── 3. Persist the new access token ─────────────────────────────────────────
  // Patreon refresh tokens are not rotated, so we only update the access token
  // and expiry. If the response includes a new refresh token, persist it too.
  const tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  } = await tokenRes.json();

  const newExpiry = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();
  const newAccessTokenEnc = encryptToken(tokens.access_token);
  const newRefreshTokenEnc = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : undefined;

  const updatePayload: Record<string, unknown> = {
    access_token_enc: newAccessTokenEnc,
    token_expires_at: newExpiry,
    status: "active",
  };
  if (newRefreshTokenEnc) {
    updatePayload.refresh_token_enc = newRefreshTokenEnc;
  }

  // Optimistic concurrency: only update if the stored token hasn't changed.
  const { data: updatedRows, error: updateError } = await supabase
    .from("connected_platforms")
    .update(updatePayload)
    .eq("id", platformRow.id)
    .eq("access_token_enc", platformRow.access_token_enc)
    .select("id");

  if (updateError) {
    // Log but don't fail — we can still use the fresh token for this run.
    console.error(
      `[ensureValidPatreonToken] Failed to persist refreshed token for` +
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
      `[ensureValidPatreonToken] Failed to set reauth_required for` +
        ` platform ${platformId}: ${error.message}`
    );
  }
}
