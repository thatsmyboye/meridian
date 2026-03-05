/**
 * Inngest function: publish a scheduled derivative to its target platform.
 *
 * Triggered by: repurpose/derivative.scheduled
 * Cancelled by: repurpose/derivative.publish_cancelled (matches on schedule_id)
 *
 * Flow:
 *  1. sleep-until-scheduled — sleeps until the creator's chosen publish time
 *  2. load-job             — loads the job, derivative, and platform credentials
 *  3. publish              — calls the per-platform API (Twitter, Instagram, etc.)
 *  4. mark-published       — updates derivative status to "published" + stores external_id
 *
 * On repeated failure (after Inngest retries are exhausted), the derivative is
 * marked "failed_publish" and an alert event is sent to notify the creator.
 *
 * Retry policy: 4 attempts with Inngest's default exponential back-off.
 */

import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { publishDerivative, type PlatformRow } from "../lib/platform-publishers";

// ─── Derivative shape stored in repurpose_jobs.derivatives ───────────────────

interface Derivative {
  format: string;
  content: string;
  platform: string;
  char_count: number;
  status: string;
  scheduled_at: string | null;
  schedule_id: string | null;
  published_at: string | null;
  publish_error: string | null;
  previous_drafts: string[];
  created_at: string;
  updated_at: string;
}

// ─── Platform → DB platform_name mapping ─────────────────────────────────────

// Maps derivative format key to the platform_name enum stored in connected_platforms
const FORMAT_TO_PLATFORM_DB: Record<string, string> = {
  twitter_thread: "twitter",
  linkedin_post: "linkedin",
  instagram_caption: "instagram",
  newsletter_blurb: "other", // Beehiiv is stored as 'other'
  tiktok_script: "tiktok",
};

// ─── Inngest function ─────────────────────────────────────────────────────────

export const publishScheduledDerivative = inngest.createFunction(
  {
    id: "publish-scheduled-derivative",
    name: "Publish Scheduled Derivative",
    retries: 4,
    // Cancel this run when the creator cancels the schedule.
    // Inngest matches: event.data.schedule_id === trigger.data.schedule_id
    cancelOn: [
      {
        event: "repurpose/derivative.publish_cancelled",
        match: "data.schedule_id",
      },
    ],
  },
  { event: "repurpose/derivative.scheduled" },
  async ({ event, step }) => {
    const { creator_id, repurpose_job_id, format_key, schedule_id, scheduled_at } =
      event.data;

    // ── Step 1: sleep until the scheduled publish time ─────────────────────
    await step.sleepUntil("sleep-until-scheduled", new Date(scheduled_at));

    // ── Step 2: load job, derivative, and platform credentials ─────────────
    const jobData = await step.run("load-job", async () => {
      const supabase = getSupabaseAdmin();

      const { data: job, error: jobErr } = await supabase
        .from("repurpose_jobs")
        .select("id, creator_id, derivatives")
        .eq("id", repurpose_job_id)
        .eq("creator_id", creator_id)
        .single();

      if (jobErr || !job) {
        throw new Error(
          `Job ${repurpose_job_id} not found: ${jobErr?.message ?? "unknown error"}`
        );
      }

      const derivatives = (job.derivatives ?? []) as Derivative[];
      const derivative = derivatives.find((d) => d.format === format_key);

      if (!derivative) {
        throw new Error(
          `Derivative ${format_key} not found in job ${repurpose_job_id}`
        );
      }

      // If derivative was already cancelled or changed status, abort
      if (derivative.status !== "scheduled") {
        return { skip: true, reason: `derivative status is '${derivative.status}', not 'scheduled'` };
      }

      // Verify schedule_id still matches (guards against reschedule races)
      if (derivative.schedule_id !== schedule_id) {
        return { skip: true, reason: "schedule_id mismatch — superseded by reschedule" };
      }

      // Determine which platform DB name to look up
      const dbPlatform = FORMAT_TO_PLATFORM_DB[format_key];
      if (!dbPlatform) {
        throw new Error(`No platform mapping for format: ${format_key}`);
      }

      // Load the connected platform for this creator
      // For newsletter_blurb (beehiiv) we look up 'beehiiv'; 'other' is the platform_name
      const platformLookup = format_key === "newsletter_blurb" ? "beehiiv" : dbPlatform;

      const { data: platform, error: platformErr } = await supabase
        .from("connected_platforms")
        .select("platform_user_id, access_token_enc, refresh_token_enc, metadata, status")
        .eq("creator_id", creator_id)
        .eq("platform", platformLookup)
        .eq("status", "active")
        .single();

      if (platformErr || !platform) {
        throw new Error(
          `No active ${platformLookup} connection for creator ${creator_id}: ${platformErr?.message ?? "not found"}`
        );
      }

      return {
        skip: false,
        content: derivative.content,
        platformName: format_key === "newsletter_blurb" ? "other" : dbPlatform,
        platform: {
          platform_user_id: platform.platform_user_id,
          access_token_enc: platform.access_token_enc,
          refresh_token_enc: platform.refresh_token_enc,
          metadata: platform.metadata as Record<string, unknown> | null,
        } satisfies PlatformRow,
      };
    });

    // Skip if the derivative was superseded or already handled
    if (jobData.skip) {
      return {
        repurpose_job_id,
        format_key,
        status: "skipped",
        reason: jobData.reason,
      };
    }

    // ── Step 3: publish to the platform ───────────────────────────────────
    const publishResult = await step.run("publish", async () => {
      return publishDerivative(
        jobData.platformName!,
        jobData.platform!,
        jobData.content!
      );
    });

    // ── Step 4: mark derivative as published ──────────────────────────────
    await step.run("mark-published", async () => {
      const supabase = getSupabaseAdmin();
      const now = new Date().toISOString();

      const { data: job } = await supabase
        .from("repurpose_jobs")
        .select("derivatives, scheduled_derivative_ids")
        .eq("id", repurpose_job_id)
        .single();

      if (!job) return;

      const derivatives = (job.derivatives ?? []) as Derivative[];
      const updatedDerivatives = derivatives.map((d) => {
        if (d.format !== format_key) return d;
        return {
          ...d,
          status: "published",
          published_at: now,
          publish_error: null,
          updated_at: now,
        };
      });

      // Remove this format from scheduled_derivative_ids
      const scheduledIds = (job.scheduled_derivative_ids ?? {}) as Record<string, string>;
      delete scheduledIds[format_key];

      await supabase
        .from("repurpose_jobs")
        .update({
          derivatives: JSON.parse(JSON.stringify(updatedDerivatives)),
          scheduled_derivative_ids: scheduledIds,
        })
        .eq("id", repurpose_job_id);
    });

    return {
      repurpose_job_id,
      format_key,
      schedule_id,
      status: "published",
      external_id: publishResult.external_id,
      url: publishResult.url,
    };
  }
);

// ─── Failure handler ──────────────────────────────────────────────────────────

/**
 * Marks the derivative as "failed_publish" when all Inngest retries are exhausted.
 * Fires a creator alert so they can take action.
 *
 * This is registered as a separate Inngest function using onFailure.
 */
export const handlePublishFailure = inngest.createFunction(
  {
    id: "handle-publish-failure",
    name: "Handle Publish Failure",
    retries: 0,
  },
  {
    event: "inngest/function.failed",
    // Only handle failures from our publish function
    if: "event.data.function_id == 'publish-scheduled-derivative'",
  },
  async ({ event, step }) => {
    const originalEvent = event.data.event as {
      data: {
        creator_id: string;
        repurpose_job_id: string;
        format_key: string;
      };
    };

    const { creator_id, repurpose_job_id, format_key } =
      originalEvent.data;

    await step.run("mark-failed", async () => {
      const supabase = getSupabaseAdmin();
      const now = new Date().toISOString();

      const { data: job } = await supabase
        .from("repurpose_jobs")
        .select("derivatives, scheduled_derivative_ids")
        .eq("id", repurpose_job_id)
        .single();

      if (!job) return;

      const derivatives = (job.derivatives ?? []) as Derivative[];
      const updatedDerivatives = derivatives.map((d) => {
        if (d.format !== format_key) return d;
        return {
          ...d,
          status: "failed_publish",
          publish_error:
            (event.data.error as { message?: string } | undefined)?.message ??
            "Publishing failed after multiple retries.",
          updated_at: now,
        };
      });

      // Remove from scheduled_derivative_ids
      const scheduledIds = (job.scheduled_derivative_ids ?? {}) as Record<string, string>;
      delete scheduledIds[format_key];

      await supabase
        .from("repurpose_jobs")
        .update({
          derivatives: JSON.parse(JSON.stringify(updatedDerivatives)),
          scheduled_derivative_ids: scheduledIds,
        })
        .eq("id", repurpose_job_id);
    });

    // Fetch creator email for alert notification
    await step.run("alert-creator", async () => {
      const supabase = getSupabaseAdmin();
      const { data: creator } = await supabase
        .from("creators")
        .select("email, display_name")
        .eq("id", creator_id)
        .single();

      if (!creator) return;

      // Log the failure — in production this would trigger a Resend email
      // similar to the weekly digest pattern. The creator email/Resend
      // integration follows the same pattern as WeeklyDigestEmail.
      console.error(
        `[publish-failure] Creator ${creator.display_name} (${creator.email}) ` +
          `failed to publish ${format_key} for job ${repurpose_job_id}. ` +
          `Error: ${(event.data.error as { message?: string } | undefined)?.message}`
      );
    });

    return {
      creator_id,
      repurpose_job_id,
      format_key,
      status: "failed_publish",
    };
  }
);
