import { inngest } from "../client";
import { ensureValidInstagramToken } from "../lib/refreshInstagramToken";
import { normalizeMetrics } from "../lib/normalizeMetrics";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { SNAPSHOT_DAY_MARKS, type DayMark } from "../lib/snapshotDayMarks";

// ─── Instagram Insights API response types ────────────────────────────────────

/**
 * A single metric result from the Instagram Insights API.
 *
 * Meta introduced a `total_value` field in Graph API v19.0 for some endpoints
 * as an alternative to the `values` array. Both formats are still returned
 * depending on the metric and API version, so we handle both defensively.
 */
interface InstagramInsightsResult {
  name: string;
  period: string;
  /** Standard format: lifetime metrics as a single-element array. */
  values?: Array<{ value: number }>;
  /** Newer format (v19.0+): aggregate lifetime value returned as an object. */
  total_value?: { value: number };
  id: string;
}

interface InstagramInsightsResponse {
  data: InstagramInsightsResult[];
}

/**
 * Extracts the numeric value from an insights result, handling both the
 * older `values[0].value` array format and the newer `total_value.value`
 * object format that Meta introduced in Graph API v19.0.
 */
function extractInsightValue(metric: InstagramInsightsResult): number {
  if (metric.total_value !== undefined) {
    return metric.total_value.value ?? 0;
  }
  return metric.values?.[0]?.value ?? 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Insights metrics requested for all Instagram media types (IMAGE,
 * CAROUSEL_ALBUM, VIDEO, REEL).
 *
 * Since Meta deprecated both `impressions` and `plays` on April 21, 2025,
 * `views` is the unified replacement across all media types — for images it
 * counts impressions, for videos/Reels it counts plays. The remaining metrics
 * (reach, saved, shares) are identical for all types. likes and comments are
 * fetched from the media object directly (like_count / comments_count).
 */
const MEDIA_METRICS = "views,reach,saved,shares";

// ─── Cron: daily scheduler ────────────────────────────────────────────────────

/**
 * Runs every day at 04:00 UTC (1 hour after the YouTube cron to spread load).
 *
 * For each lifecycle day mark (1, 7, 30) it finds Instagram content items
 * whose publication date falls within a ±12-hour window of that mark and
 * that have not yet received a snapshot for that mark. It then fans-out one
 * `analytics/snapshot.requested` event per eligible item.
 *
 * Steps:
 *  1. load-active-instagram-platforms   – All active Instagram platform IDs.
 *  2. find-unsnapshotted-day-{N}        – Items needing a snapshot at mark N.
 *  3. dispatch-snapshot-events          – Fan-out events to the snapshot handler.
 */
export const instagramAnalyticsCron = inngest.createFunction(
  {
    id: "instagram-analytics-cron",
    name: "Instagram Analytics Daily Snapshot Cron",
    retries: 1,
  },
  { cron: "0 4 * * *" },
  async ({ step }) => {
    // ── Step 1: resolve all active Instagram connected platform IDs ───────────
    const activePlatformIds = await step.run(
      "load-active-instagram-platforms",
      async () => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("connected_platforms")
          .select("id")
          .eq("platform", "instagram")
          .eq("status", "active");

        if (error) {
          throw new Error(
            `Failed to load active Instagram platforms: ${error.message}`
          );
        }

        return (data ?? []).map((p) => p.id as string);
      }
    );

    if (activePlatformIds.length === 0) {
      return {
        message: "No active Instagram platforms found — nothing to snapshot.",
        snapshotsEnqueued: 0,
      };
    }

    // ── Step 2: for each day mark, find items that still need a snapshot ──────
    const eventsToSend: Array<{
      name: "analytics/snapshot.requested";
      data: {
        creator_id: string;
        content_item_id: string;
        platform: "instagram";
        day_mark: DayMark;
      };
    }> = [];

    for (const dayMark of SNAPSHOT_DAY_MARKS) {
      const itemsNeedingSnapshot = await step.run(
        `find-unsnapshotted-day-${dayMark}`,
        async () => {
          const supabase = getSupabaseAdmin();
          const now = new Date();

          // ±12-hour window around the exact day mark
          const lower = new Date(
            now.getTime() - (dayMark + 0.5) * 86_400_000
          ).toISOString();
          const upper = new Date(
            now.getTime() - (dayMark - 0.5) * 86_400_000
          ).toISOString();

          const { data: candidates, error: candidateError } = await supabase
            .from("content_items")
            .select("id, creator_id")
            .eq("platform", "instagram")
            .in("platform_id", activePlatformIds)
            .gte("published_at", lower)
            .lte("published_at", upper);

          if (candidateError) {
            throw new Error(
              `Failed to query content_items for day-${dayMark} mark: ${candidateError.message}`
            );
          }

          if (!candidates?.length) return [];

          // Filter out items that already have a snapshot for this day mark.
          const { data: existing, error: existingError } = await supabase
            .from("performance_snapshots")
            .select("content_item_id")
            .in(
              "content_item_id",
              candidates.map((c) => c.id)
            )
            .eq("day_mark", dayMark);

          if (existingError) {
            throw new Error(
              `Failed to check existing snapshots for day-${dayMark}: ${existingError.message}`
            );
          }

          const alreadySnapshotted = new Set(
            (existing ?? []).map((e) => e.content_item_id as string)
          );

          return candidates
            .filter((c) => !alreadySnapshotted.has(c.id as string))
            .map((c) => ({
              id: c.id as string,
              creator_id: c.creator_id as string,
            }));
        }
      );

      for (const item of itemsNeedingSnapshot) {
        eventsToSend.push({
          name: "analytics/snapshot.requested",
          data: {
            creator_id: item.creator_id,
            content_item_id: item.id,
            platform: "instagram",
            day_mark: dayMark,
          },
        });
      }
    }

    // ── Step 3: fan-out one event per eligible content item ───────────────────
    if (eventsToSend.length > 0) {
      await step.sendEvent("dispatch-snapshot-events", eventsToSend);
    }

    return {
      activePlatforms: activePlatformIds.length,
      snapshotsEnqueued: eventsToSend.length,
    };
  }
);

// ─── Snapshot handler ─────────────────────────────────────────────────────────

/**
 * Fetches Instagram Insights for a single content item and stores a
 * `performance_snapshots` row.
 *
 * Triggered by: `analytics/snapshot.requested` (platform === "instagram")
 *
 * The Instagram Insights API returns lifetime metrics (cumulative totals
 * from the time the media was posted). This matches the lifecycle-day-mark
 * approach: at day 1, 7, and 30 after posting we capture where the post
 * stands at that point in time.
 *
 * likes and comments are read from the media object (like_count /
 * comments_count) rather than the insights endpoint, as those fields are
 * returned directly by the media API.
 *
 * Steps:
 *  1. load-content-and-platform  – Load the content item and credentials.
 *  2. ensure-valid-token         – Decrypt/refresh the Instagram access token.
 *  3. fetch-instagram-insights   – Call the Insights API for the media item.
 *  4. store-snapshot             – Insert a row into performance_snapshots.
 */
export const fetchInstagramAnalyticsSnapshot = inngest.createFunction(
  {
    id: "fetch-instagram-analytics-snapshot",
    name: "Fetch Instagram Analytics Snapshot",
    retries: 3,
    // Limit concurrent Meta API calls to respect rate limits.
    concurrency: { limit: 5 },
  },
  { event: "analytics/snapshot.requested", if: "event.data.platform == 'instagram'" },
  async ({ event, step }) => {
    const { creator_id, content_item_id, platform, day_mark } = event.data;

    if (platform !== "instagram") {
      return { skipped: true, reason: "platform is not instagram" };
    }

    // ── Step 1: load content item + connected platform row ────────────────────
    const { contentItem, platformRow } = await step.run(
      "load-content-and-platform",
      async () => {
        const supabase = getSupabaseAdmin();

        const { data: item, error: itemError } = await supabase
          .from("content_items")
          .select("id, external_id, platform_id")
          .eq("id", content_item_id)
          .single();

        if (itemError || !item) {
          throw new Error(
            `Content item not found (id=${content_item_id}): ${itemError?.message}`
          );
        }
        if (!item.external_id) {
          throw new Error(
            `Content item ${content_item_id} is missing external_id`
          );
        }
        if (!item.platform_id) {
          throw new Error(
            `Content item ${content_item_id} has no linked connected_platform`
          );
        }

        const { data: cp, error: cpError } = await supabase
          .from("connected_platforms")
          .select("id, access_token_enc, token_expires_at")
          .eq("id", item.platform_id)
          .single();

        if (cpError || !cp) {
          throw new Error(
            `Connected platform not found (id=${item.platform_id}): ${cpError?.message}`
          );
        }

        return {
          contentItem: item as {
            id: string;
            external_id: string;
            platform_id: string;
          },
          platformRow: cp as {
            id: string;
            access_token_enc: string;
            token_expires_at: string | null;
          },
        };
      }
    );

    // ── Step 2: obtain a valid access token ───────────────────────────────────
    const tokenResult = await step.run("ensure-valid-token", async () => {
      return ensureValidInstagramToken(platformRow, getSupabaseAdmin());
    });

    if (!tokenResult.ok) {
      return {
        content_item_id,
        day_mark: day_mark ?? null,
        skipped: true,
        reason: tokenResult.reason,
      };
    }

    const accessToken = tokenResult.accessToken;

    // ── Step 3: fetch Instagram Insights for this media item ──────────────────
    const metrics = await step.run("fetch-instagram-insights", async () => {
      // Fetch insights (views, reach, saved, shares).
      // period=lifetime requests cumulative totals from the time the media was
      // posted, which is what we want for lifecycle day-mark snapshots.
      const insightsUrl = new URL(
        `https://graph.facebook.com/v21.0/${contentItem.external_id}/insights`
      );
      insightsUrl.searchParams.set("metric", MEDIA_METRICS);
      insightsUrl.searchParams.set("period", "lifetime");

      const insightsRes = await fetch(insightsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!insightsRes.ok) {
        throw new Error(
          `Instagram Insights API failed (${insightsRes.status}): ${await insightsRes.text()}`
        );
      }

      const insightsData: InstagramInsightsResponse = await insightsRes.json();

      // Build a metric → value map, handling both `values[0].value` (standard)
      // and `total_value.value` (Graph API v19.0+ aggregate format).
      const metricsMap: Record<string, number> = {};
      for (const metric of insightsData.data) {
        metricsMap[metric.name] = extractInsightValue(metric);
      }

      // Fetch like_count and comments_count directly from the media object
      // (they are not available via the Insights endpoint)
      const mediaUrl = new URL(
        `https://graph.facebook.com/v21.0/${contentItem.external_id}`
      );
      mediaUrl.searchParams.set("fields", "like_count,comments_count");

      const mediaRes = await fetch(mediaUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let likesCount = 0;
      let commentsCount = 0;

      if (mediaRes.ok) {
        const mediaData: { like_count?: number; comments_count?: number } =
          await mediaRes.json();
        likesCount = mediaData.like_count ?? 0;
        commentsCount = mediaData.comments_count ?? 0;
      } else {
        console.warn(
          `[instagram-snapshot] Could not fetch like/comment counts for` +
            ` media ${contentItem.external_id}: ${await mediaRes.text()}`
        );
      }

      return {
        // `views` is Meta's unified metric (Apr 2025): counts impressions for
        // images/carousels and plays for videos/Reels, replacing the now-
        // deprecated `impressions` and `plays` metrics.
        views: metricsMap["views"] ?? 0,
        reach: metricsMap["reach"] ?? 0,
        saves: metricsMap["saved"] ?? 0,
        shares: metricsMap["shares"] ?? 0,
        likes: likesCount,
        comments: commentsCount,
        rawInsights: insightsData,
      };
    });

    // ── Step 4: persist the snapshot ──────────────────────────────────────────
    await step.run("store-snapshot", async () => {
      const supabase = getSupabaseAdmin();

      // Normalise platform-native metrics into the canonical schema.
      // Instagram mapping:
      //   views              ← views (Meta's unified metric, Apr 2025)
      //   engagement_rate    ← (likes + comments + shares + saves) / views
      //   watch_time_seconds ← null (not exposed by the Instagram API)
      const normalized = normalizeMetrics({
        platform: "instagram",
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
      });

      const { error } = await supabase.from("performance_snapshots").insert({
        content_item_id,
        creator_id,
        views: normalized.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        reach: metrics.reach,
        engagement_rate: normalized.engagement_rate,
        // watch_time_seconds is null for Instagram; leave watch_time_minutes unset.
        // Meta's `views` metric is the post-deprecation replacement for
        // `impressions` (images) and `plays` (videos/Reels) as of Apr 2025.
        // We store it in both columns so the normalised schema remains
        // consistent with other platforms that report impressions separately.
        impressions: metrics.views,
        day_mark: day_mark ?? null,
        raw_data: { api_response: metrics.rawInsights },
      });

      if (error) {
        // 23505 = unique_violation: a snapshot for this day_mark already exists.
        if (error.code === "23505") {
          return { duplicate: true };
        }
        throw new Error(
          `Failed to insert performance_snapshots row: ${error.message}`
        );
      }

      return { inserted: true };
    });

    return {
      content_item_id,
      day_mark: day_mark ?? null,
      views: metrics.views,
      reach: metrics.reach,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      saves: metrics.saves,
    };
  }
);
