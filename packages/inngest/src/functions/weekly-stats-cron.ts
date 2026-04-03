import { inngest } from "../client";
import { sendPushNotificationsToCreator } from "../lib/sendPushNotifications";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import {
  narratePatternInsights,
  type PatternNarration,
} from "../lib/narratePatternInsights";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const LENGTH_BUCKET_LABELS: Record<string, string> = {
  short: "short (≤60s)",
  medium: "medium (61–600s)",
  long: "long (>600s)",
  newsletter: "newsletter",
};

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  beehiiv: "Beehiiv",
  linkedin: "LinkedIn",
  twitter: "X (Twitter)",
  substack: "Substack",
};

// ─── Internal types ───────────────────────────────────────────────────────────

interface SnapshotRow {
  content_item_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  open_rate: number | null;
  engagement_rate: number | null;
  snapshot_at: string;
  platform: string;
  published_at: string;
  duration_seconds: number | null;
}

interface PatternInsightRecord {
  insight_type: string;
  summary: string;
  evidence_json: Record<string, unknown>;
  confidence: number;
  narrative: string | null;
  confidence_label: PatternNarration["confidence_label"] | null;
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function sampleStd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(
    xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  );
}

/**
 * Confidence score based purely on sample count.
 * Scales linearly from 0 → 1 as n grows from 0 → 30.
 * Full confidence (1.000) at 30+ samples per group.
 */
function confidenceFromCount(n: number): number {
  return parseFloat(Math.min(1.0, n / 30).toFixed(3));
}

function lengthBucket(durationSeconds: number | null): string {
  if (durationSeconds === null) return "newsletter";
  if (durationSeconds <= 60) return "short";
  if (durationSeconds <= 600) return "medium";
  return "long";
}

/** ISO week key in the form "YYYY-WNN" for grouping content by calendar week. */
function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  // Shift to Thursday so that week boundaries follow ISO 8601 (Mon–Sun weeks).
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Derive a per-platform engagement rate from raw interaction columns.
 * Used when the stored `engagement_rate` column is null (e.g. older rows
 * captured before the column was added).
 *
 *  YouTube / Instagram  ← (likes + comments + shares + saves) / views
 *  Beehiiv              ← open_rate / 100  (already a percentage 0–100)
 */
function deriveEngagementRate(row: SnapshotRow): number {
  if (row.engagement_rate !== null) return row.engagement_rate;
  if (row.platform === "beehiiv") {
    return row.open_rate !== null ? row.open_rate / 100 : 0;
  }
  if (row.views <= 0) return 0;
  const interactions = row.likes + row.comments + row.shares + row.saves;
  return Math.min(1, interactions / row.views);
}

// ─── Cron: weekly scheduler ───────────────────────────────────────────────────

/**
 * Runs every Sunday at 02:00 UTC.
 *
 * Finds every creator whose oldest `performance_snapshot` is ≥30 days old
 * (meaning they have at least 30 days of historical data), then fans out one
 * `patterns/analysis.requested` event per qualifying creator so that
 * `computeCreatorPatterns` can process them independently with retries.
 *
 * Steps:
 *  1. find-qualifying-creators  – Distinct creator IDs with ≥30-day-old data.
 *  2. dispatch-analysis-events  – Fan-out one event per creator.
 */
export const weeklyStatsCron = inngest.createFunction(
  {
    id: "weekly-stats-cron",
    name: "Weekly Creator Stats Pattern Cron",
    retries: 1,
  },
  { cron: "0 2 * * 0" }, // Every Sunday at 02:00 UTC
  async ({ step }) => {
    // ── Step 1: find creators with ≥30 days of historical snapshot data ────────
    const qualifyingCreatorIds = await step.run(
      "find-qualifying-creators",
      async () => {
        const supabase = getSupabaseAdmin();
        // A creator qualifies if they have at least one snapshot that is
        // at least 30 days old — meaning they have been active for 30+ days.
        const cutoff = new Date(
          Date.now() - 30 * 86_400_000
        ).toISOString();

        const { data, error } = await supabase
          .from("performance_snapshots")
          .select("creator_id")
          .lte("snapshot_at", cutoff);

        if (error) {
          throw new Error(
            `Failed to find qualifying creators: ${error.message}`
          );
        }

        return [
          ...new Set((data ?? []).map((r) => r.creator_id as string)),
        ];
      }
    );

    if (qualifyingCreatorIds.length === 0) {
      return {
        message: "No qualifying creators found — nothing to analyse.",
        analysisEnqueued: 0,
      };
    }

    // ── Step 2: fan-out one analysis event per creator ────────────────────────
    await step.sendEvent(
      "dispatch-analysis-events",
      qualifyingCreatorIds.map((creator_id) => ({
        name: "patterns/analysis.requested" as const,
        data: { creator_id },
      }))
    );

    return {
      creatorsFound: qualifyingCreatorIds.length,
      analysisEnqueued: qualifyingCreatorIds.length,
    };
  }
);

// ─── Pattern computation handler ──────────────────────────────────────────────

/**
 * Computes statistical performance patterns for a single creator and writes
 * up to four `pattern_insights` rows — one per analysis dimension:
 *
 *  • day_of_week       – mean/std of views & engagement by day of publication
 *  • content_type      – mean/std by platform (YouTube, Instagram, Beehiiv, …)
 *  • length_bucket     – mean/std by content duration (short/medium/long/newsletter)
 *  • posting_frequency – engagement lift in high-frequency vs low-frequency weeks
 *
 * For each dimension the confidence score is `min(1.0, best_group_n / 30)`:
 * groups with ≥30 samples get full confidence (1.000); smaller groups are
 * down-weighted proportionally.
 *
 * Existing non-dismissed insights for the same creator + insight_type are
 * deleted before the fresh rows are inserted, so the table never accumulates
 * stale duplicates across weekly runs.
 *
 * Triggered by: `patterns/analysis.requested`
 *
 * Steps:
 *  1. load-snapshots       – Latest snapshot per content item, joined with
 *                            content_items for metadata (platform, published_at,
 *                            duration_seconds).
 *  2. compute-patterns     – Pure statistics: no I/O, fully deterministic.
 *  3. write-pattern-insights – Replace stale insights and insert fresh rows.
 */
export const computeCreatorPatterns = inngest.createFunction(
  {
    id: "compute-creator-patterns",
    name: "Compute Creator Pattern Insights",
    retries: 2,
    // Allow up to 10 creators to be processed in parallel without overloading
    // the database with concurrent read/write bursts.
    concurrency: { limit: 5 },
  },
  { event: "patterns/analysis.requested" },
  async ({ event, step }) => {
    const { creator_id } = event.data;

    // ── Step 1: load snapshots joined with content item metadata ──────────────
    const snapshots = await step.run("load-snapshots", async () => {
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from("performance_snapshots")
        .select(
          `
          content_item_id,
          views,
          likes,
          comments,
          shares,
          saves,
          open_rate,
          engagement_rate,
          snapshot_at,
          content_items!inner (
            platform,
            published_at,
            duration_seconds
          )
        `
        )
        .eq("creator_id", creator_id)
        // Descending so the first row per content_item_id is the most recent.
        .order("snapshot_at", { ascending: false });

      if (error) {
        throw new Error(
          `Failed to load snapshots for creator ${creator_id}: ${error.message}`
        );
      }

      // Keep only the latest snapshot per content item (most mature data).
      const seen = new Set<string>();
      const deduped: SnapshotRow[] = [];

      for (const row of data ?? []) {
        const itemId = row.content_item_id as string;
        if (seen.has(itemId)) continue;
        seen.add(itemId);

        // Supabase returns a joined row object, not an array, for many-to-one FK.
        const item = Array.isArray(row.content_items)
          ? row.content_items[0]
          : row.content_items;

        if (!item?.published_at) continue;

        deduped.push({
          content_item_id: itemId,
          views: (row.views as number) ?? 0,
          likes: (row.likes as number) ?? 0,
          comments: (row.comments as number) ?? 0,
          shares: (row.shares as number) ?? 0,
          saves: (row.saves as number) ?? 0,
          open_rate: row.open_rate as number | null,
          engagement_rate: row.engagement_rate as number | null,
          snapshot_at: row.snapshot_at as string,
          platform: item.platform as string,
          published_at: item.published_at as string,
          duration_seconds: item.duration_seconds as number | null,
        });
      }

      return deduped;
    });

    if (snapshots.length === 0) {
      return {
        creator_id,
        skipped: true,
        reason: "No snapshots found for this creator",
      };
    }

    // ── Step 2: compute all four statistical pattern dimensions ───────────────
    const insights = await step.run("compute-patterns", async () => {
      const results: PatternInsightRecord[] = [];
      const now = new Date().toISOString();

      // Pre-derive engagement rates for every snapshot once so we don't
      // repeat the fallback computation inside each analysis block.
      const enriched = snapshots.map((s) => ({
        ...s,
        derived_engagement: deriveEngagementRate(s),
      }));

      // ── Day-of-week analysis ───────────────────────────────────────────────
      {
        type DayBucket = { views: number[]; engagement: number[] };
        const byDay: Record<number, DayBucket> = {};
        for (let d = 0; d < 7; d++) byDay[d] = { views: [], engagement: [] };

        for (const s of enriched) {
          const day = new Date(s.published_at).getDay(); // 0 = Sun … 6 = Sat
          byDay[day].views.push(s.views);
          byDay[day].engagement.push(s.derived_engagement);
        }

        const days = (Object.entries(byDay) as [string, DayBucket][])
          .map(([d, { views, engagement }]) => ({
            day: Number(d),
            name: DAY_NAMES[Number(d)],
            sample_count: views.length,
            mean_views: parseFloat(mean(views).toFixed(1)),
            std_views: parseFloat(sampleStd(views).toFixed(1)),
            mean_engagement: parseFloat(mean(engagement).toFixed(4)),
            std_engagement: parseFloat(sampleStd(engagement).toFixed(4)),
          }))
          .filter((d) => d.sample_count > 0);

        if (days.length > 0) {
          const totalPosts = days.reduce((s, d) => s + d.sample_count, 0);
          // Sort descending by mean_engagement to find the best day.
          const sorted = [...days].sort(
            (a, b) => b.mean_engagement - a.mean_engagement
          );
          const best = sorted[0];

          results.push({
            insight_type: "day_of_week",
            summary: `Content published on ${best.name} performs best with ${(best.mean_engagement * 100).toFixed(1)}% avg engagement (${best.sample_count} of ${totalPosts} posts analysed).`,
            evidence_json: {
              analysis_type: "day_of_week",
              total_posts_analysed: totalPosts,
              // Return days sorted by calendar order for readability.
              days: days.sort((a, b) => a.day - b.day),
              best_day: { day: best.day, name: best.name },
              computed_at: now,
            },
            confidence: confidenceFromCount(best.sample_count),
            narrative: null,
            confidence_label: null,
          });
        }
      }

      // ── Content-type analysis ──────────────────────────────────────────────
      {
        type TypeBucket = { views: number[]; engagement: number[] };
        const byType: Record<string, TypeBucket> = {};

        for (const s of enriched) {
          if (!byType[s.platform]) {
            byType[s.platform] = { views: [], engagement: [] };
          }
          byType[s.platform].views.push(s.views);
          byType[s.platform].engagement.push(s.derived_engagement);
        }

        const types = Object.entries(byType).map(
          ([content_type, { views, engagement }]) => ({
            content_type,
            sample_count: views.length,
            mean_views: parseFloat(mean(views).toFixed(1)),
            std_views: parseFloat(sampleStd(views).toFixed(1)),
            mean_engagement: parseFloat(mean(engagement).toFixed(4)),
            std_engagement: parseFloat(sampleStd(engagement).toFixed(4)),
          })
        );

        if (types.length > 0) {
          const best = [...types].sort(
            (a, b) => b.mean_engagement - a.mean_engagement
          )[0];

          results.push({
            insight_type: "content_type",
            summary: `${PLATFORM_DISPLAY_NAMES[best.content_type] ?? best.content_type} content leads with ${(best.mean_engagement * 100).toFixed(1)}% avg engagement across ${best.sample_count} posts.`,
            evidence_json: {
              analysis_type: "content_type",
              total_posts_analysed: enriched.length,
              types,
              best_type: best.content_type,
              computed_at: now,
            },
            confidence: confidenceFromCount(best.sample_count),
            narrative: null,
            confidence_label: null,
          });
        }
      }

      // ── Length-bucket analysis ─────────────────────────────────────────────
      {
        type BucketData = { views: number[]; engagement: number[] };
        const byBucket: Record<string, BucketData> = {};

        for (const s of enriched) {
          const bucket = lengthBucket(s.duration_seconds);
          if (!byBucket[bucket]) {
            byBucket[bucket] = { views: [], engagement: [] };
          }
          byBucket[bucket].views.push(s.views);
          byBucket[bucket].engagement.push(s.derived_engagement);
        }

        const buckets = Object.entries(byBucket).map(
          ([bucket, { views, engagement }]) => ({
            bucket,
            label: LENGTH_BUCKET_LABELS[bucket] ?? bucket,
            sample_count: views.length,
            mean_views: parseFloat(mean(views).toFixed(1)),
            std_views: parseFloat(sampleStd(views).toFixed(1)),
            mean_engagement: parseFloat(mean(engagement).toFixed(4)),
            std_engagement: parseFloat(sampleStd(engagement).toFixed(4)),
          })
        );

        if (buckets.length > 0) {
          // Prefer a non-newsletter bucket as "best" when video content exists,
          // since comparing video lengths is more actionable than newsletter vs video.
          const videoBuckets = buckets.filter((b) => b.bucket !== "newsletter");
          const pool = videoBuckets.length > 0 ? videoBuckets : buckets;
          const best = [...pool].sort(
            (a, b) => b.mean_engagement - a.mean_engagement
          )[0];

          results.push({
            insight_type: "length_bucket",
            summary: `${best.label.charAt(0).toUpperCase() + best.label.slice(1)} content achieves the highest engagement at ${(best.mean_engagement * 100).toFixed(1)}% avg across ${best.sample_count} posts.`,
            evidence_json: {
              analysis_type: "length_bucket",
              total_posts_analysed: enriched.length,
              buckets,
              best_bucket: best.bucket,
              computed_at: now,
            },
            confidence: confidenceFromCount(best.sample_count),
            narrative: null,
            confidence_label: null,
          });
        }
      }

      // ── Posting-frequency analysis ─────────────────────────────────────────
      {
        // Group content items by ISO calendar week using publication date.
        type WeekData = { count: number; engagement: number[] };
        const byWeek: Record<string, WeekData> = {};

        for (const s of enriched) {
          const key = isoWeekKey(new Date(s.published_at));
          if (!byWeek[key]) byWeek[key] = { count: 0, engagement: [] };
          byWeek[key].count++;
          byWeek[key].engagement.push(s.derived_engagement);
        }

        const weeks = Object.values(byWeek);

        // Require at least 4 weeks of data for a meaningful frequency split.
        if (weeks.length >= 4) {
          const postCounts = weeks.map((w) => w.count);
          const medianCount = medianOf(postCounts);
          const avgPostsPerWeek = parseFloat(mean(postCounts).toFixed(1));

          const highWeeks = weeks.filter((w) => w.count > medianCount);
          const lowWeeks = weeks.filter((w) => w.count <= medianCount);

          const highEngagement = highWeeks.flatMap((w) => w.engagement);
          const lowEngagement = lowWeeks.flatMap((w) => w.engagement);

          const highMeanEng = mean(highEngagement);
          const lowMeanEng = mean(lowEngagement);
          const engDiff = highMeanEng - lowMeanEng;
          const pctLift =
            lowMeanEng > 0
              ? parseFloat(((engDiff / lowMeanEng) * 100).toFixed(1))
              : 0;

          const direction = engDiff >= 0 ? "higher" : "lower";
          const absPct = Math.abs(pctLift);

          results.push({
            insight_type: "posting_frequency",
            summary: `Publishing more than ${medianCount} post${medianCount === 1 ? "" : "s"}/week correlates with ${absPct}% ${direction} avg engagement (${weeks.length} weeks analysed).`,
            evidence_json: {
              analysis_type: "posting_frequency",
              weeks_analysed: weeks.length,
              avg_posts_per_week: avgPostsPerWeek,
              median_posts_per_week: medianCount,
              high_frequency: {
                threshold_posts_per_week: medianCount,
                sample_weeks: highWeeks.length,
                mean_engagement: parseFloat(highMeanEng.toFixed(4)),
                std_engagement: parseFloat(sampleStd(highEngagement).toFixed(4)),
              },
              low_frequency: {
                threshold_posts_per_week: medianCount,
                sample_weeks: lowWeeks.length,
                mean_engagement: parseFloat(lowMeanEng.toFixed(4)),
                std_engagement: parseFloat(sampleStd(lowEngagement).toFixed(4)),
              },
              engagement_lift_pct: pctLift,
              computed_at: now,
            },
            confidence: confidenceFromCount(weeks.length),
            narrative: null,
            confidence_label: null,
          });
        }
      }

      return results;
    });

    if (insights.length === 0) {
      return {
        creator_id,
        skipped: true,
        reason: "Insufficient data to compute any pattern dimension",
      };
    }

    // ── Step 3: narrate each statistical pattern via Claude ────────────────────
    //
    // Calls claude-opus-4-6 once per insight to produce a 2–3 sentence plain-
    // English narrative that creators can read instead of raw statistics.
    // Individual failures are caught inside narratePatternInsights() so the
    // record simply omits that key; the statistical `summary` is the fallback.
    const narrations = await step.run(
      "narrate-pattern-insights",
      async () => {
        return narratePatternInsights(
          insights.map(({ insight_type, summary, evidence_json, confidence }) => ({
            insight_type,
            summary,
            evidence_json,
            confidence,
          }))
        );
      }
    );

    // Merge narrations back into the insight records.
    const narratedInsights = insights.map((insight) => ({
      ...insight,
      narrative: narrations[insight.insight_type]?.narrative ?? null,
      confidence_label:
        narrations[insight.insight_type]?.confidence_label ?? null,
    }));

    // ── Step 4: replace stale insights, insert fresh ones ─────────────────────
    await step.run("write-pattern-insights", async () => {
      const supabase = getSupabaseAdmin();
      const insightTypes = narratedInsights.map((i) => i.insight_type);

      // Delete non-dismissed insights for the same creator + type so that
      // each weekly run produces exactly one fresh row per dimension.
      const { error: deleteError } = await supabase
        .from("pattern_insights")
        .delete()
        .eq("creator_id", creator_id)
        .eq("is_dismissed", false)
        .in("insight_type", insightTypes);

      if (deleteError) {
        throw new Error(
          `Failed to clear stale pattern insights for creator ${creator_id}: ${deleteError.message}`
        );
      }

      const rows = narratedInsights.map((insight) => ({
        creator_id,
        insight_type: insight.insight_type,
        summary: insight.summary,
        narrative: insight.narrative,
        confidence_label: insight.confidence_label,
        evidence_json: insight.evidence_json,
        confidence: insight.confidence,
        generated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("pattern_insights")
        .insert(rows);

      if (insertError) {
        throw new Error(
          `Failed to insert pattern insights for creator ${creator_id}: ${insertError.message}`
        );
      }

      return { written: rows.length };
    });

    // ── Step 5: send push notification to creator's mobile devices ───────────
    await step.run("notify-insights-push", async () => {
      await sendPushNotificationsToCreator(
        creator_id,
        "New insights available",
        "Your weekly pattern insights are ready. Tap to review.",
        { screen: "insights" }
      );
    });

    return {
      creator_id,
      insightsWritten: narratedInsights.length,
      insightTypes: narratedInsights.map((i) => i.insight_type),
      narratedCount: narratedInsights.filter((i) => i.narrative !== null).length,
    };
  }
);
