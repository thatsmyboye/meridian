import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

/**
 * Expire Trials Cron
 *
 * Runs hourly. Finds every creator whose promo-code trial has ended
 * (`trial_ends_at <= now()` and `trial_tier IS NOT NULL`) and reverts
 * their `subscription_tier` to `pre_trial_tier` (the tier they held
 * before redeeming the code), then clears the trial columns.
 *
 * This is the only place trial expiry is enforced — the `subscription_tier`
 * column is the single source of truth consumed by all limit-checking code,
 * so reverting it here is sufficient to restore the prior behaviour without
 * any other code changes.
 */
export const expireTrialsCron = inngest.createFunction(
  {
    id: "expire-trials-cron",
    name: "Expire Trials Cron",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour, on the hour
  async ({ step }) => {
    const result = await step.run("expire-ended-trials", async () => {
      const supabase = getSupabaseAdmin();

      const { data: expired, error: selectError } = await supabase
        .from("creators")
        .select("id, trial_tier, pre_trial_tier")
        .not("trial_tier", "is", null)
        .lte("trial_ends_at", new Date().toISOString());

      if (selectError) {
        throw new Error(
          `Failed to query expired trials: ${selectError.message}`
        );
      }

      if (!expired?.length) {
        return { expired: 0 };
      }

      // Revert each creator individually because pre_trial_tier may differ
      // per row — a single bulk update can't express per-row values.
      let expiredCount = 0;
      const failures: string[] = [];

      for (const creator of expired) {
        const revertTier = (creator.pre_trial_tier as string | null) ?? "free";

        const { error: updateError } = await supabase
          .from("creators")
          .update({
            subscription_tier: revertTier,
            trial_tier: null,
            trial_ends_at: null,
            pre_trial_tier: null,
          })
          .eq("id", creator.id);

        if (updateError) {
          failures.push(
            `creator ${creator.id}: ${updateError.message}`
          );
        } else {
          expiredCount++;
        }
      }

      if (failures.length) {
        // Log failures but don't throw — a partial success is still progress
        // and Inngest retries would re-process already-reverted rows.
        console.error(
          `[expire-trials-cron] ${failures.length} revert(s) failed:`,
          failures
        );
      }

      console.info(
        `[expire-trials-cron] Expired ${expiredCount} trial(s)` +
          (failures.length ? `, ${failures.length} failed` : "")
      );

      return { expired: expiredCount, failures: failures.length };
    });

    return result;
  }
);
