import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { ensureValidTikTokToken } from "../lib/refreshTikTokToken";

/**
 * TikTok Token Refresh Cron
 *
 * TikTok OAuth 2.0 access tokens expire after ~24 hours. The OAuth callback
 * also issues a refresh token (valid up to 365 days) that can be used to
 * obtain a new access token without requiring the creator to re-authenticate.
 *
 * This cron runs every 6 hours and proactively refreshes tokens that are
 * expiring within the next 30 minutes, keeping them ahead of expiry so that
 * publish jobs always have a valid token available.
 *
 * Strategy:
 *  - Select active TikTok platforms whose token expires within 30 minutes.
 *  - Attempt a refresh for each via ensureValidTikTokToken.
 *  - On refresh failure: the helper marks the platform as `reauth_required`
 *    and the dashboard can then prompt the creator to reconnect.
 */
export const tiktokTokenRefreshCron = inngest.createFunction(
  {
    id: "tiktok-token-refresh-cron",
    name: "TikTok Token Refresh Cron",
    retries: 1,
  },
  { cron: "0 */6 * * *" }, // every 6 hours
  async ({ step }) => {
    const result = await step.run(
      "refresh-expiring-tiktok-tokens",
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
          .eq("platform", "tiktok")
          .eq("status", "active")
          .or(
            `token_expires_at.is.null,token_expires_at.lte.${refreshCutoff}`
          );

        if (selectError) {
          throw new Error(
            `Failed to query TikTok platforms for expiring tokens: ${selectError.message}`
          );
        }

        if (!expiring?.length) {
          return { checked: 0, refreshed: 0, failed: 0 };
        }

        let refreshed = 0;
        let failed = 0;

        for (const platform of expiring) {
          const result = await ensureValidTikTokToken(
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
              `[tiktok-token-refresh-cron] Refreshed token for platform ${platform.id} (${platform.platform_username})`
            );
          } else {
            failed++;
            console.warn(
              `[tiktok-token-refresh-cron] Refresh failed for platform ${platform.id} (${platform.platform_username}): ${result.reason}`
            );
          }
        }

        return { checked: expiring.length, refreshed, failed };
      }
    );

    return result;
  }
);
