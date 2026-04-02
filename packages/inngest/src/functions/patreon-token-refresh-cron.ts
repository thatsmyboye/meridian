import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { ensureValidPatreonToken } from "../lib/refreshPatreonToken";

/**
 * Patreon Token Refresh Cron
 *
 * Patreon access tokens expire after ~31 days (expires_in ≈ 2678400 seconds).
 * A refresh token is issued at OAuth time and can be used to obtain a new
 * access token without requiring the creator to re-authenticate.
 *
 * This cron runs daily and proactively refreshes tokens that are expiring
 * within the next 3 days, ensuring sync and publish jobs always have a valid
 * token ahead of expiry.
 *
 * Strategy:
 *  - Select active Patreon platforms whose token expires within 3 days.
 *  - Attempt a refresh for each via ensureValidPatreonToken.
 *  - On refresh failure: the helper marks the platform as `reauth_required`
 *    and the dashboard can then prompt the creator to reconnect.
 */
export const patreonTokenRefreshCron = inngest.createFunction(
  {
    id: "patreon-token-refresh-cron",
    name: "Patreon Token Refresh Cron",
    retries: 1,
  },
  { cron: "0 6 * * *" }, // 06:00 UTC daily
  async ({ step }) => {
    const result = await step.run(
      "refresh-expiring-patreon-tokens",
      async () => {
        const supabase = getSupabaseAdmin();

        // Refresh tokens expiring within the next 3 days.
        const refreshCutoff = new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: expiring, error: selectError } = await supabase
          .from("connected_platforms")
          .select(
            "id, platform_username, access_token_enc, refresh_token_enc, token_expires_at"
          )
          .eq("platform", "patreon")
          .eq("status", "active")
          .or(
            `token_expires_at.is.null,token_expires_at.lte.${refreshCutoff}`
          );

        if (selectError) {
          throw new Error(
            `Failed to query Patreon platforms for expiring tokens: ${selectError.message}`
          );
        }

        if (!expiring?.length) {
          return { checked: 0, refreshed: 0, failed: 0 };
        }

        let refreshed = 0;
        let failed = 0;

        for (const platform of expiring) {
          const result = await ensureValidPatreonToken(
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
              `[patreon-token-refresh-cron] Refreshed token for platform ${platform.id} (${platform.platform_username})`
            );
          } else {
            failed++;
            console.warn(
              `[patreon-token-refresh-cron] Refresh failed for platform ${platform.id} (${platform.platform_username}): ${result.reason}`
            );
          }
        }

        return { checked: expiring.length, refreshed, failed };
      }
    );

    return result;
  }
);
