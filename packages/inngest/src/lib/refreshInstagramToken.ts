import { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@meridian/api";

/**
 * Instagram / Meta token refresh utilities.
 *
 * Unlike Google OAuth, Meta does not issue separate refresh tokens for
 * Instagram. Instead, it issues long-lived user access tokens (valid for
 * 60 days) that can be extended by calling the `ig_refresh_token` endpoint
 * before they expire.
 *
 * Strategy:
 *   - If the stored access token still has more than 5 minutes until expiry,
 *     decrypt and return it as-is.
 *   - If the token expires within 5 minutes (or expiry is unknown), attempt
 *     to refresh it via `GET /oauth/access_token?grant_type=ig_refresh_token`.
 *   - On success: persist the new encrypted token and updated expiry.
 *   - On failure: set connected_platforms.status = "reauth_required" so the
 *     dashboard can prompt the creator to reconnect.
 *
 * Note: Meta recommends refreshing long-lived tokens when they have fewer
 * than 5 days remaining. We use a 5-minute threshold here to stay consistent
 * with the YouTube refresh logic, but the cron keeps tokens well refreshed.
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
 * Checks whether the stored long-lived token is still valid (with a 5-minute
 * proactive buffer). If not, attempts to extend it using Meta's
 * `ig_refresh_token` grant.
 */
export async function ensureValidInstagramToken(
  platformRow: PlatformTokenRow,
  supabase: SupabaseClient<any>
): Promise<TokenRefreshResult> {
  // ── 1. Check whether the current access token is still valid ───────────────
  const expiresAt = platformRow.token_expires_at
    ? new Date(platformRow.token_expires_at)
    : null;
  const threshold = new Date(Date.now() + 5 * 60 * 1000); // 5-minute buffer
  const tokenIsValid = expiresAt !== null && expiresAt > threshold;

  if (tokenIsValid) {
    return {
      ok: true,
      accessToken: decryptToken(platformRow.access_token_enc),
    };
  }

  // ── 2. Token is expired or close to expiry — attempt a refresh ─────────────
  // Meta's ig_refresh_token grant extends the token by another 60 days.
  // It requires the current long-lived token to still be valid (not expired).
  if (!expiresAt || expiresAt <= new Date()) {
    // Token is already fully expired; the creator must reconnect.
    await markReauthRequired(supabase, platformRow.id);
    return {
      ok: false,
      reason:
        "Instagram access token has expired. The creator must reconnect their account.",
    };
  }

  const currentToken = decryptToken(platformRow.access_token_enc);

  const refreshUrl = new URL(
    `https://graph.instagram.com/${META_GRAPH_VERSION}/refresh_access_token`
  );
  refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
  refreshUrl.searchParams.set("access_token", currentToken);

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
  const refreshed: { access_token: string; expires_in: number } =
    await tokenRes.json();
  const newExpiry = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  const { error: updateError } = await supabase
    .from("connected_platforms")
    .update({
      access_token_enc: encryptToken(refreshed.access_token),
      token_expires_at: newExpiry,
      status: "active",
    })
    .eq("id", platformRow.id);

  if (updateError) {
    // Log but don't fail — we can still use the fresh token for this run.
    console.error(
      `[ensureValidInstagramToken] Failed to persist refreshed token for` +
        ` platform ${platformRow.id}: ${updateError.message}`
    );
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
