import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

/**
 * LinkedIn Token Expiry Cron
 *
 * LinkedIn does not issue refresh tokens for the member auth flow. Access
 * tokens are valid for ~60 days and cannot be extended programmatically —
 * creators must reconnect manually when they expire.
 *
 * This cron runs daily and proactively marks LinkedIn platform connections as
 * `reauth_required` before the token actually expires, giving the dashboard a
 * signal to prompt the creator to reconnect while they still can.
 *
 * Strategy:
 *  - Tokens already expired → mark `reauth_required` immediately.
 *  - Tokens expiring within 14 days → mark `reauth_required` early so creators
 *    have a window to reconnect before they silently lose posting access.
 *  - Tokens with no recorded expiry → mark `reauth_required` (unknown state
 *    is treated as potentially expired to err on the side of caution).
 */
export const linkedinTokenExpiryCron = inngest.createFunction(
  {
    id: "linkedin-token-expiry-cron",
    name: "LinkedIn Token Expiry Cron",
    retries: 1,
  },
  { cron: "0 1 * * *" }, // 01:00 UTC daily
  async ({ step }) => {
    const result = await step.run(
      "check-expiring-linkedin-tokens",
      async () => {
        const supabase = getSupabaseAdmin();

        // 14-day proactive warning window: mark tokens as reauth_required
        // while the creator still has time to reconnect before expiry.
        const warningCutoff = new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000
        ).toISOString();

        // Select active LinkedIn platforms whose token has expired, is
        // expiring within 14 days, or has no recorded expiry date.
        const { data: expiring, error: selectError } = await supabase
          .from("connected_platforms")
          .select("id, platform_username, token_expires_at")
          .eq("platform", "linkedin")
          .eq("status", "active")
          .or(
            `token_expires_at.is.null,token_expires_at.lte.${warningCutoff}`
          );

        if (selectError) {
          throw new Error(
            `Failed to query LinkedIn platforms for expiring tokens: ${selectError.message}`
          );
        }

        if (!expiring?.length) {
          return { checked: 0, markedForReauth: 0 };
        }

        const ids = expiring.map((p) => p.id as string);

        const { error: updateError } = await supabase
          .from("connected_platforms")
          .update({ status: "reauth_required" })
          .in("id", ids);

        if (updateError) {
          throw new Error(
            `Failed to mark LinkedIn tokens as reauth_required: ${updateError.message}`
          );
        }

        console.info(
          `[linkedin-token-expiry-cron] Marked ${ids.length} LinkedIn platform(s) as reauth_required`,
          expiring.map((p) => ({
            id: p.id,
            username: p.platform_username,
            expiresAt: p.token_expires_at ?? "unknown",
          }))
        );

        return { checked: expiring.length, markedForReauth: ids.length };
      }
    );

    return result;
  }
);
