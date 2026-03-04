import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "@meridian/api";
import { inngest } from "../client";

// ─── Beehiiv API v2 response types ───────────────────────────────────────────

interface BeehiivPostStats {
  email: {
    recipients: number;
    open_rate: number;
    click_rate: number;
    unique_opened: number;
    unique_clicked: number;
  };
  web: {
    impressions: number;
    unique_impressions: number;
  };
}

interface BeehiivPostDetailResponse {
  data: {
    id: string;
    stats: BeehiivPostStats;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Day marks (days after publication) at which we capture analytics snapshots. */
const SNAPSHOT_DAY_MARKS = [1, 7, 30] as const;
type DayMark = (typeof SNAPSHOT_DAY_MARKS)[number];

// ─── Cron: daily scheduler ────────────────────────────────────────────────────

/**
 * Runs every day at 05:00 UTC (1 hour after the Instagram cron to spread load).
 *
 * For each lifecycle day mark (1, 7, 30) it finds Beehiiv newsletter posts
 * whose publication date falls within a ±12-hour window of that mark and that
 * have not yet received a snapshot for that mark. It then fans-out one
 * `analytics/snapshot.requested` event per eligible post.
 *
 * Steps:
 *  1. load-active-beehiiv-platforms  – All active Beehiiv connected platform IDs.
 *  2. find-unsnapshotted-day-{N}     – Posts needing a snapshot at mark N.
 *  3. dispatch-snapshot-events       – Fan-out events to the snapshot handler.
 */
export const beehiivAnalyticsCron = inngest.createFunction(
  {
    id: "beehiiv-analytics-cron",
    name: "Beehiiv Analytics Daily Snapshot Cron",
    retries: 1,
  },
  { cron: "0 5 * * *" },
  async ({ step }) => {
    // ── Step 1: resolve all active Beehiiv connected platform IDs ─────────────
    const activePlatformIds = await step.run(
      "load-active-beehiiv-platforms",
      async () => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("connected_platforms")
          .select("id")
          .eq("platform", "beehiiv")
          .eq("status", "active");

        if (error) {
          throw new Error(
            `Failed to load active Beehiiv platforms: ${error.message}`
          );
        }

        return (data ?? []).map((p) => p.id as string);
      }
    );

    if (activePlatformIds.length === 0) {
      return {
        message: "No active Beehiiv platforms found — nothing to snapshot.",
        snapshotsEnqueued: 0,
      };
    }

    // ── Step 2: for each day mark, find posts that still need a snapshot ──────
    const eventsToSend: Array<{
      name: "analytics/snapshot.requested";
      data: {
        creator_id: string;
        content_item_id: string;
        platform: "beehiiv";
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
            .eq("platform", "beehiiv")
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
            platform: "beehiiv",
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
 * Fetches Beehiiv post stats for a single newsletter post and stores a
 * `performance_snapshots` row.
 *
 * Triggered by: `analytics/snapshot.requested` (platform === "beehiiv")
 *
 * Beehiiv returns cumulative lifetime stats per post (recipients, opens,
 * clicks, rates). We capture these at day 1, 7, and 30 after publication.
 *
 * Metric mapping:
 *   views      ← stats.email.unique_opened   (email open count)
 *   reach      ← stats.email.recipients      (total recipients)
 *   clicks     ← stats.email.unique_clicked  (unique link clicks)
 *   open_rate  ← stats.email.open_rate       (percentage, e.g. 42.5)
 *   click_rate ← stats.email.click_rate      (percentage, e.g. 5.2)
 *   impressions← stats.web.impressions       (web view count)
 *
 * Steps:
 *  1. load-content-and-platform  – Load the content item + encrypted API key.
 *  2. fetch-beehiiv-stats        – Call the Beehiiv posts API with expand=stats.
 *  3. store-snapshot             – Insert a row into performance_snapshots.
 */
export const fetchBeehiivAnalyticsSnapshot = inngest.createFunction(
  {
    id: "fetch-beehiiv-analytics-snapshot",
    name: "Fetch Beehiiv Analytics Snapshot",
    retries: 3,
    concurrency: { limit: 5 },
  },
  {
    event: "analytics/snapshot.requested",
    if: "event.data.platform == 'beehiiv'",
  },
  async ({ event, step }) => {
    const { creator_id, content_item_id, platform, day_mark } = event.data;

    if (platform !== "beehiiv") {
      return { skipped: true, reason: "platform is not beehiiv" };
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
          .select("id, access_token_enc, platform_user_id")
          .eq("id", item.platform_id)
          .single();

        if (cpError || !cp) {
          throw new Error(
            `Connected platform not found (id=${item.platform_id}): ${cpError?.message}`
          );
        }

        const apiKey = decryptToken(cp.access_token_enc as string);

        return {
          contentItem: item as {
            id: string;
            external_id: string;
            platform_id: string;
          },
          platformRow: {
            id: cp.id as string,
            apiKey,
            publicationId: cp.platform_user_id as string,
          },
        };
      }
    );

    // ── Step 2: fetch post stats from Beehiiv API ─────────────────────────────
    const metrics = await step.run("fetch-beehiiv-stats", async () => {
      const url = new URL(
        `https://api.beehiiv.com/v2/publications/${encodeURIComponent(
          platformRow.publicationId
        )}/posts/${encodeURIComponent(contentItem.external_id)}`
      );
      url.searchParams.set("expand[]", "stats");

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${platformRow.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(
          `Beehiiv post stats API failed (${res.status}): ${await res.text()}`
        );
      }

      const body: BeehiivPostDetailResponse = await res.json();
      const stats = body.data.stats;

      return {
        uniqueOpened: stats.email?.unique_opened ?? 0,
        recipients: stats.email?.recipients ?? 0,
        uniqueClicked: stats.email?.unique_clicked ?? 0,
        openRate: stats.email?.open_rate ?? 0,
        clickRate: stats.email?.click_rate ?? 0,
        webImpressions: stats.web?.impressions ?? 0,
        rawStats: stats,
      };
    });

    // ── Step 3: persist the snapshot ──────────────────────────────────────────
    await step.run("store-snapshot", async () => {
      const supabase = getSupabaseAdmin();

      const { error } = await supabase.from("performance_snapshots").insert({
        content_item_id,
        creator_id,
        // Map newsletter metrics to the shared performance_snapshots schema.
        views: metrics.uniqueOpened,
        reach: metrics.recipients,
        clicks: metrics.uniqueClicked,
        open_rate: metrics.openRate,
        click_rate: metrics.clickRate,
        impressions: metrics.webImpressions,
        // Newsletters do not have likes, comments, shares, or saves.
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        day_mark: day_mark ?? null,
        raw_data: { stats: metrics.rawStats },
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
      views: metrics.uniqueOpened,
      reach: metrics.recipients,
      clicks: metrics.uniqueClicked,
      open_rate: metrics.openRate,
      click_rate: metrics.clickRate,
    };
  }
);
