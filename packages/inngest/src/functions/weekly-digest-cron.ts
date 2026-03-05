import { render } from "@react-email/components";
import { Resend } from "resend";
import * as React from "react";
import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import {
  WeeklyDigestEmail,
  type DigestContentItem,
  type DigestInsight,
} from "../emails/WeeklyDigestEmail";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the creator's local clock reads Monday between 08:00 and
 * 08:59 (i.e., the cron's current UTC hour maps to 8 AM Monday in `timezone`).
 */
function isMonday8am(timezone: string): boolean {
  try {
    const now = new Date();
    // Build a Date in the creator's locale so .getDay() / .getHours() are local.
    const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    return local.getDay() === 1 && local.getHours() === 8;
  } catch {
    return false;
  }
}

/**
 * Derive a short actionable tip from the available digest data.
 *
 * Priority order:
 *  1. Top insight's narrative (Claude-generated, already actionable)
 *  2. Best vs worst content comparison
 *  3. Generic encouragement
 */
function deriveActionableTip(
  insights: DigestInsight[],
  bestContent: DigestContentItem | null,
  worstContent: DigestContentItem | null
): string {
  // Use the top insight's narrative when available.
  const topInsight = insights[0];
  if (topInsight?.narrative) {
    return topInsight.narrative;
  }
  if (topInsight?.summary) {
    return topInsight.summary;
  }

  // Fall back to a best/worst comparison.
  if (bestContent && worstContent) {
    const bestEng = bestContent.engagement_rate ?? 0;
    const worstEng = worstContent.engagement_rate ?? 0;
    if (bestEng > 0 && worstEng >= 0) {
      const lift = bestEng > 0 ? ((bestEng - worstEng) / bestEng) * 100 : 0;
      return `Your best piece outperformed your weakest by ${lift.toFixed(0)}%. Study what made "${bestContent.item.title.slice(0, 50)}" work and apply the same formula to your next post.`;
    }
  }

  return "Consistency is the strongest predictor of long-term growth. Keep showing up — your data will reveal patterns as your library grows.";
}

// ─── Cron: hourly scheduler ───────────────────────────────────────────────────

/**
 * Runs every hour, seven days a week.
 *
 * For each invocation it checks which creators' local time is currently
 * Monday 08:xx and fans out one `digest/weekly.send` event per matching
 * creator so that `sendWeeklyDigest` can process them independently.
 *
 * Running hourly (rather than a single Monday-only cron) ensures creators in
 * every timezone — from UTC-12 to UTC+14 — receive the email at 8 AM their
 * local time.
 *
 * Steps:
 *  1. find-eligible-creators – Load all creators with a real email address
 *                              and filter to those whose local time is Mon 8 AM.
 *  2. dispatch-digest-emails – Fan-out one send event per eligible creator.
 */
export const weeklyDigestCron = inngest.createFunction(
  {
    id: "weekly-digest-cron",
    name: "Weekly Digest Email Scheduler",
    retries: 1,
  },
  { cron: "0 * * * *" }, // Every hour — timezone filtering happens inside
  async ({ step }) => {
    const eligibleCreatorIds = await step.run(
      "find-eligible-creators",
      async () => {
        const supabase = getSupabaseAdmin();

        const { data: creators, error } = await supabase
          .from("creators")
          .select("id, timezone")
          // Exclude synthetic placeholder emails created for phone/magic-link
          // accounts that have never provided a real address.
          .not("email", "like", "%@meridian.placeholder%");

        if (error) {
          throw new Error(`Failed to fetch creators: ${error.message}`);
        }

        return (creators ?? [])
          .filter((c) => isMonday8am(c.timezone ?? "UTC"))
          .map((c) => c.id as string);
      }
    );

    if (eligibleCreatorIds.length === 0) {
      return { message: "No creators at Monday 8 AM this hour", sent: 0 };
    }

    await step.sendEvent(
      "dispatch-digest-emails",
      eligibleCreatorIds.map((creator_id) => ({
        name: "digest/weekly.send" as const,
        data: { creator_id },
      }))
    );

    return {
      eligibleCreators: eligibleCreatorIds.length,
      dispatched: eligibleCreatorIds.length,
    };
  }
);

// ─── Handler: send one creator's digest ──────────────────────────────────────

/**
 * Fetches a creator's weekly data and sends their digest email via Resend.
 *
 * Triggered by: `digest/weekly.send`
 *
 * Steps:
 *  1. fetch-digest-data  – Load creator info, top 2 pattern insights, and the
 *                          best/worst performing content from the past 7 days.
 *  2. send-email         – Render the React Email template and deliver via Resend.
 */
export const sendWeeklyDigest = inngest.createFunction(
  {
    id: "send-weekly-digest",
    name: "Send Weekly Digest Email",
    retries: 2,
    concurrency: { limit: 10 },
  },
  { event: "digest/weekly.send" },
  async ({ event, step }) => {
    const { creator_id } = event.data;

    // ── Step 1: fetch everything needed to render the digest ──────────────────
    const digestData = await step.run("fetch-digest-data", async () => {
      const supabase = getSupabaseAdmin();
      const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

      // Creator profile
      const { data: creator, error: creatorError } = await supabase
        .from("creators")
        .select("id, display_name, email, timezone")
        .eq("id", creator_id)
        .single();

      if (creatorError || !creator) {
        throw new Error(
          `Creator ${creator_id} not found: ${creatorError?.message ?? "no row"}`
        );
      }

      // Top 2 pattern insights (highest confidence first, non-dismissed)
      const { data: insightRows } = await supabase
        .from("pattern_insights")
        .select(
          "insight_type, summary, narrative, confidence_label, confidence"
        )
        .eq("creator_id", creator_id)
        .eq("is_dismissed", false)
        .order("confidence", { ascending: false })
        .limit(2);

      const insights: DigestInsight[] = (insightRows ?? []).map((r) => ({
        insight_type: r.insight_type as string,
        summary: r.summary as string,
        narrative: r.narrative as string | null,
        confidence_label: r.confidence_label as string | null,
        confidence: r.confidence as number,
      }));

      // Recent performance snapshots joined with content metadata.
      // We look at snapshots taken in the past 7 days so that we pick up
      // content published recently (not necessarily only this week's new posts).
      const { data: snapshotRows } = await supabase
        .from("performance_snapshots")
        .select(
          `
          content_item_id,
          views,
          engagement_rate,
          snapshot_at,
          content_items!inner (
            title,
            platform,
            url,
            published_at
          )
        `
        )
        .eq("creator_id", creator_id)
        .gte("snapshot_at", weekAgoIso)
        .order("snapshot_at", { ascending: false });

      // Deduplicate — keep the most recent snapshot per content item.
      const seen = new Set<string>();
      const recentContent: DigestContentItem[] = [];

      for (const row of snapshotRows ?? []) {
        const itemId = row.content_item_id as string;
        if (seen.has(itemId)) continue;
        seen.add(itemId);

        const item = Array.isArray(row.content_items)
          ? row.content_items[0]
          : row.content_items;

        if (!item?.title) continue;

        recentContent.push({
          content_item_id: itemId,
          views: row.views as number | null,
          engagement_rate: row.engagement_rate as number | null,
          item: {
            title: item.title as string,
            platform: item.platform as string,
            url: item.url as string | null,
            published_at: item.published_at as string,
          },
        });
      }

      // Count pieces published in the past 7 days (not all with snapshots).
      const totalPieces = recentContent.filter(
        (c) => c.item.published_at >= weekAgoIso
      ).length;

      // Sort by engagement rate descending to find best/worst.
      const sortedByEngagement = [...recentContent].sort(
        (a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0)
      );

      const bestContent = sortedByEngagement[0] ?? null;
      const worstContent =
        sortedByEngagement.length > 1
          ? sortedByEngagement[sortedByEngagement.length - 1]
          : null;

      const actionableTip = deriveActionableTip(
        insights,
        bestContent,
        worstContent
      );

      return {
        creator,
        insights,
        bestContent,
        worstContent,
        totalPieces,
        actionableTip,
      };
    });

    // ── Step 2: render and send the email ─────────────────────────────────────
    await step.run("send-email", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY!);

      const weekStart = new Date(Date.now() - 7 * 86_400_000);
      const weekEnd = new Date();

      const html = await render(
        React.createElement(WeeklyDigestEmail, {
          creatorName: digestData.creator.display_name as string,
          weekStart,
          weekEnd,
          insights: digestData.insights,
          bestContent: digestData.bestContent,
          worstContent: digestData.worstContent,
          totalPieces: digestData.totalPieces,
          actionableTip: digestData.actionableTip,
        })
      );

      const fmtDate = (d: Date) =>
        d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

      const { error } = await resend.emails.send({
        from: "Meridian <digest@meridian.app>",
        to: digestData.creator.email as string,
        subject: `Your weekly digest — ${fmtDate(weekStart)} to ${fmtDate(weekEnd)}`,
        html,
      });

      if (error) {
        throw new Error(
          `Resend failed for creator ${creator_id}: ${JSON.stringify(error)}`
        );
      }
    });

    return { creator_id, sent: true };
  }
);
