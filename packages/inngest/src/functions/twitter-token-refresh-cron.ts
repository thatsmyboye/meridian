import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { ensureValidTwitterToken } from "../lib/refreshTwitterToken";

/**
 * Twitter Token Refresh Cron
 *
 * Twitter OAuth 2.0 access tokens (user auth) expire after a short window
 * (typically 2 hours). With the `offline.access` scope, the OAuth callback
 * also issues a refresh token that can be used to obtain a new access token
 * without requiring the creator to re-authenticate.
 *
 * Twitter uses rotating refresh tokens — each refresh invalidates the
 * previous refresh token and issues a new one. Both tokens are updated in
 * connected_platforms after every successful refresh.
 *
 * This cron runs hourly and proactively refreshes tokens that are expiring
 * within the next 30 minutes, keeping them ahead of expiry so that
 * publish jobs always have a valid token available.
 *
 * Strategy:
 *  - Select active Twitter platforms whose token expires within 30 minutes.
 *  - Attempt a refresh for each via ensureValidTwitterToken.
 *  - On refresh failure: the helper marks the platform as `reauth_required`
 *    and the dashboard can then prompt the creator to reconnect.
 */
export const twitterTokenRefreshCron = inngest.createFunction(
  {
    id: "twitter-token-refresh-cron",
    name: "Twitter Token Refresh Cron",
    retries: 1,
  },
  { cron: "0 * * * *" }, // top of every hour
  async ({ step }) => {
    const result = await step.run(
      "refresh-expiring-twitter-tokens",
      async () => {
        const supabase = getSupabaseAdmin();

        // Refresh tokens expiring within the next 30 minutes.
        const refreshCutoff = new Date(
          Date.now() + 30 * 60 * 1000
        ).toISOString();

        const { data: expiring, error: selectError } = await supabase
          .from("connected_platforms")
          .select(
            "id, platform_username, access_token_enc, refresh_token_enc, token_expires_at"
          )
          .eq("platform", "twitter")
          .eq("status", "active")
          .or(
            `token_expires_at.is.null,token_expires_at.lte.${refreshCutoff}`
          );

        if (selectError) {
          throw new Error(
            `Failed to query Twitter platforms for expiring tokens: ${selectError.message}`
          );
        }

        if (!expiring?.length) {
          return { checked: 0, refreshed: 0, failed: 0 };
        }

        let refreshed = 0;
        let failed = 0;

        for (const platform of expiring) {
          const result = await ensureValidTwitterToken(
            {
              id: platform.id as string,
              access_token_enc: platform.access_token_enc as string,
              refresh_token_enc: platform.refresh_token_enc as string | null,
              token_expires_at: platform.token_expires_at as string | null,
            },
            supabase
          );

          if (result.ok) {
            refreshed++;
            console.info(
              `[twitter-token-refresh-cron] Refreshed token for platform ${platform.id} (${platform.platform_username})`
            );
          } else {
            failed++;
            console.warn(
              `[twitter-token-refresh-cron] Refresh failed for platform ${platform.id} (${platform.platform_username}): ${result.reason}`
            );
          }
        }

        return { checked: expiring.length, refreshed, failed };
      }
    );

    return result;
  }
);
