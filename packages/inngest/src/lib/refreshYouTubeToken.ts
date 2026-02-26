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
 * Ensures a valid YouTube access token is available for a connected platform.
 *
 * Checks whether the stored access token is still valid (with a 5-minute
 * proactive buffer). If not, attempts to refresh it using the stored refresh
 * token via Google's OAuth2 token endpoint.
 *
 * On success:
 *   - Persists the new encrypted access token + expiry to connected_platforms.
 *   - Sets status back to "active".
 *   - Returns { ok: true, accessToken }.
 *
 * On failure (no refresh token stored, or Google rejects the refresh):
 *   - Sets connected_platforms.status = "reauth_required" so the dashboard
 *     can surface a re-auth alert to the creator.
 *   - Returns { ok: false, reason } — callers should return early rather than
 *     throwing, so Inngest does not retry and burn API quota.
 */
export async function ensureValidYouTubeToken(
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
        "No refresh token stored. The creator must reconnect their YouTube account.",
    };
  }

  const refreshToken = decryptToken(platformRow.refresh_token_enc);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error(
      `[ensureValidYouTubeToken] Refresh failed for platform ${platformRow.id}` +
        ` (${tokenRes.status}): ${body}`
    );
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason: `OAuth token refresh rejected by Google (${tokenRes.status}). Creator must reconnect.`,
    };
  }

  // ── 3. Persist the new access token ────────────────────────────────────────
  const tokens: { access_token: string; expires_in: number } =
    await tokenRes.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("connected_platforms")
    .update({
      access_token_enc: encryptToken(tokens.access_token),
      token_expires_at: newExpiry,
      status: "active",
    })
    .eq("id", platformRow.id);

  if (updateError) {
    // Log but don't fail — we can still use the fresh token for this run.
    console.error(
      `[ensureValidYouTubeToken] Failed to persist refreshed token for` +
        ` platform ${platformRow.id}: ${updateError.message}`
    );
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
      `[ensureValidYouTubeToken] Failed to set reauth_required for` +
        ` platform ${platformId}: ${error.message}`
    );
  }
}
