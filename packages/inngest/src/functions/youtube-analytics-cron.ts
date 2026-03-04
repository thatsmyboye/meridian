import { inngest } from "../client";
import { ensureValidYouTubeToken } from "../lib/refreshYouTubeToken";
import { normalizeMetrics } from "../lib/normalizeMetrics";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { SNAPSHOT_DAY_MARKS, type DayMark } from "../lib/snapshotDayMarks";

// ─── YouTube Analytics API response type ─────────────────────────────────────

interface YouTubeAnalyticsReport {
  kind: string;
  columnHeaders: Array<{
    name: string;
    columnType: string;
    dataType: string;
  }>;
  /** Each row: [videoId, views, estimatedMinutesWatched, likes, comments, shares] */
  rows?: Array<Array<string | number>>;
}

// ─── Cron: daily scheduler ────────────────────────────────────────────────────

/**
 * Runs every day at 03:00 UTC.
 *
 * For each lifecycle day mark (1, 7, 30) it finds YouTube content items whose
 * publication date falls within a ±12-hour window of that mark and that have
 * not yet received a snapshot for that mark. It then fans-out one
 * `analytics/snapshot.requested` event per eligible item so that
 * `fetchYoutubeAnalyticsSnapshot` can process them independently.
 *
 * Steps:
 *  1. load-active-youtube-platforms   – All active YouTube platform IDs.
 *  2. find-unsnapshotted-day-{N}      – Items needing a snapshot at mark N.
 *  3. dispatch-snapshot-events        – Fan-out events to the snapshot handler.
 */
export const youtubeAnalyticsCron = inngest.createFunction(
  {
    id: "youtube-analytics-cron",
    name: "YouTube Analytics Daily Snapshot Cron",
    retries: 1,
  },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    // ── Step 1: resolve all active YouTube connected platform IDs ─────────────
    const activePlatformIds = await step.run(
      "load-active-youtube-platforms",
      async () => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("connected_platforms")
          .select("id")
          .eq("platform", "youtube")
          .eq("status", "active");

        if (error) {
          throw new Error(
            `Failed to load active YouTube platforms: ${error.message}`
          );
        }

        return (data ?? []).map((p) => p.id as string);
      }
    );

    if (activePlatformIds.length === 0) {
      return {
        message: "No active YouTube platforms found — nothing to snapshot.",
        snapshotsEnqueued: 0,
      };
    }

    // ── Step 2: for each day mark, find items that still need a snapshot ──────
    const eventsToSend: Array<{
      name: "analytics/snapshot.requested";
      data: {
        creator_id: string;
        content_item_id: string;
        platform: "youtube";
        day_mark: DayMark;
      };
    }> = [];

    for (const dayMark of SNAPSHOT_DAY_MARKS) {
      const itemsNeedingSnapshot = await step.run(
        `find-unsnapshotted-day-${dayMark}`,
        async () => {
          const supabase = getSupabaseAdmin();
          const now = new Date();

          // ±12-hour window around the exact day mark so we catch items even
          // if the cron runs slightly late or the publish time drifts.
          const lower = new Date(
            now.getTime() - (dayMark + 0.5) * 86_400_000
          ).toISOString();
          const upper = new Date(
            now.getTime() - (dayMark - 0.5) * 86_400_000
          ).toISOString();

          const { data: candidates, error: candidateError } = await supabase
            .from("content_items")
            .select("id, creator_id")
            .eq("platform", "youtube")
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
            platform: "youtube",
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
 * Fetches YouTube Analytics metrics for a single content item and stores a
 * `performance_snapshots` row.
 *
 * Triggered by: `analytics/snapshot.requested` (platform === "youtube")
 *
 * Steps:
 *  1. load-content-and-platform  – Load the content item row and its linked
 *                                   connected_platforms credentials.
 *  2. ensure-valid-token         – Decrypt the stored access token; if it has
 *                                   expired (or expires within 5 minutes),
 *                                   exchange the refresh token for a new one
 *                                   and persist the updated ciphertext.
 *  3. fetch-youtube-analytics    – Call the YouTube Analytics /reports endpoint
 *                                   for cumulative metrics from publish date
 *                                   through today.
 *  4. store-snapshot             – Insert a row into performance_snapshots.
 *                                   The day_mark unique partial index ensures
 *                                   idempotent re-runs never duplicate rows.
 */
export const fetchYoutubeAnalyticsSnapshot = inngest.createFunction(
  {
    id: "fetch-youtube-analytics-snapshot",
    name: "Fetch YouTube Analytics Snapshot",
    retries: 3,
    // Limit concurrent YouTube API calls to respect quota and avoid bursts.
    concurrency: { limit: 5 },
  },
  { event: "analytics/snapshot.requested", if: "event.data.platform == 'youtube'" },
  async ({ event, step }) => {
    const { creator_id, content_item_id, platform, day_mark } = event.data;

    if (platform !== "youtube") {
      return { skipped: true, reason: "platform is not youtube" };
    }

    // ── Step 1: load content item + connected platform row ────────────────────
    const { contentItem, platformRow } = await step.run(
      "load-content-and-platform",
      async () => {
        const supabase = getSupabaseAdmin();

        const { data: item, error: itemError } = await supabase
          .from("content_items")
          .select("id, external_id, platform_id, published_at")
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
        if (!item.published_at) {
          throw new Error(
            `Content item ${content_item_id} is missing published_at`
          );
        }
        if (!item.platform_id) {
          throw new Error(
            `Content item ${content_item_id} has no linked connected_platform`
          );
        }

        const { data: cp, error: cpError } = await supabase
          .from("connected_platforms")
          .select(
            "id, access_token_enc, refresh_token_enc, token_expires_at"
          )
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
            published_at: string;
          },
          platformRow: cp as {
            id: string;
            access_token_enc: string;
            refresh_token_enc: string | null;
            token_expires_at: string | null;
          },
        };
      }
    );

    // ── Step 2: obtain a valid access token ───────────────────────────────────
    // Checks expiry (5-minute buffer) and refreshes via Google if needed.
    // On refresh failure, marks the platform as reauth_required and returns
    // early — we do NOT throw so Inngest skips retries that would burn quota.
    const tokenResult = await step.run("ensure-valid-token", async () => {
      return ensureValidYouTubeToken(platformRow, getSupabaseAdmin());
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

    // ── Step 3: call YouTube Analytics API ────────────────────────────────────
    const metrics = await step.run("fetch-youtube-analytics", async () => {
      // Use the video's publish date as startDate so the metrics are cumulative
      // from the moment the video went live through today.
      const startDate = contentItem.published_at.split("T")[0]; // YYYY-MM-DD
      const endDate = new Date().toISOString().split("T")[0];

      const url = new URL(
        "https://youtubeanalytics.googleapis.com/v2/reports"
      );
      url.searchParams.set("ids", "channel==MINE");
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);
      // Metrics columns (indices 1-5 in each row):
      //   views | estimatedMinutesWatched | likes | comments | shares
      url.searchParams.set(
        "metrics",
        "views,estimatedMinutesWatched,likes,comments,shares"
      );
      url.searchParams.set("dimensions", "video");
      url.searchParams.set(
        "filters",
        `video==${contentItem.external_id}`
      );

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(
          `YouTube Analytics API failed (${res.status}): ${await res.text()}`
        );
      }

      const report: YouTubeAnalyticsReport = await res.json();

      // row = [videoId, views, estimatedMinutesWatched, likes, comments, shares]
      const row = report.rows?.[0];

      if (!row) {
        // The video may be too new, private, or have no data in this window.
        return null;
      }

      return {
        views: Number(row[1]),
        estimatedMinutesWatched: Number(row[2]),
        likes: Number(row[3]),
        comments: Number(row[4]),
        shares: Number(row[5]),
        rawReport: report,
      };
    });

    if (!metrics) {
      return {
        content_item_id,
        day_mark: day_mark ?? null,
        skipped: true,
        reason: "YouTube Analytics returned no rows for this video",
      };
    }

    // ── Step 4: persist the snapshot ──────────────────────────────────────────
    await step.run("store-snapshot", async () => {
      const supabase = getSupabaseAdmin();

      // Normalise platform-native metrics into the canonical schema.
      // YouTube mapping:
      //   views              ← views (direct)
      //   engagement_rate    ← (likes + comments + shares) / views
      //   watch_time_seconds ← estimatedMinutesWatched × 60
      const normalized = normalizeMetrics({
        platform: "youtube",
        views: metrics.views,
        estimatedMinutesWatched: metrics.estimatedMinutesWatched,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
      });

      const { error } = await supabase.from("performance_snapshots").insert({
        content_item_id,
        creator_id,
        views: normalized.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        engagement_rate: normalized.engagement_rate,
        // DB column stores minutes; convert from normalized seconds.
        watch_time_minutes: normalized.watch_time_seconds !== null
          ? normalized.watch_time_seconds / 60
          : null,
        day_mark: day_mark ?? null,
        raw_data: {
          estimated_minutes_watched: metrics.estimatedMinutesWatched,
          api_response: metrics.rawReport,
        },
      });

      if (error) {
        // 23505 = unique_violation: a snapshot for this day_mark already exists.
        // This can happen if the event was delivered twice; treat it as a no-op.
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
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
    };
  }
);
