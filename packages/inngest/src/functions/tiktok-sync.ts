import { ensureValidTikTokToken } from "../lib/refreshTikTokToken";
import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── TikTok Video List API response types ─────────────────────────────────────

interface TikTokVideo {
  id: string;
  title?: string;
  cover_image_url?: string;
  video_description?: string;
  duration?: number;      // seconds
  create_time?: number;   // Unix timestamp (seconds)
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

interface TikTokVideoListResponse {
  data?: {
    videos: TikTokVideo[];
    cursor: number;
    has_more: boolean;
  };
  error?: {
    code: string;
    message: string;
    log_id?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs a creator's TikTok videos into content_items, and upserts a
 * performance_snapshot for each video using the engagement metrics returned
 * by the Video List API (view_count, like_count, comment_count, share_count).
 *
 * Triggered by: content/sync.requested  (platform === "tiktok")
 *
 * The TikTok Video List API (`POST /v2/video/list/`) uses cursor-based
 * pagination. We page through results upserting each video into content_items
 * and performance_snapshots.
 *
 * Steps:
 *  1. fetch-platform      – Load connected_platforms row.
 *  2. sync-page-<cursor>  – One step per page (20 videos each).
 *                           Each step fetches a page, upserts rows into
 *                           content_items, then upserts snapshots with the
 *                           current engagement metrics.
 *  3. mark-synced         – Stamp last_synced_at on connected_platforms.
 *
 * Note: The access token is decrypted and refreshed outside of any step so
 * that the plaintext token is never serialised into Inngest step state.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY    – TikTok app client key
 *   TIKTOK_CLIENT_SECRET – TikTok app client secret
 */
export const syncTikTokVideos = inngest.createFunction(
  {
    id: "sync-tiktok-videos",
    name: "Sync TikTok Videos",
    retries: 3,
    onFailure: async ({ event }) => {
      // Stamp last_synced_at so the /connect page spinner always resolves,
      // even when the sync job exhausts all retries without completing.
      // Also record the error message so the UI can show a failure state.
      const { connected_platform_id } = event.data.event.data;
      await getSupabaseAdmin()
        .from("connected_platforms")
        .update({
          last_synced_at: new Date().toISOString(),
          sync_error: event.data.error.message,
        })
        .eq("id", connected_platform_id);
    },
  },
  { event: "content/sync.requested", if: "event.data.platform == 'tiktok'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "tiktok") {
      return { skipped: true, reason: "platform is not tiktok" };
    }

    // ── Step 1: load the connected platform row ──────────────────────────────
    const platformRow = await step.run("fetch-platform", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("connected_platforms")
        .select("id, access_token_enc, refresh_token_enc, token_expires_at")
        .eq("id", connected_platform_id)
        .single();

      if (error || !data) {
        throw new Error(
          `Connected platform not found (id=${connected_platform_id}): ${error?.message}`
        );
      }

      return data as {
        id: string;
        access_token_enc: string;
        refresh_token_enc: string | null;
        token_expires_at: string | null;
      };
    });

    // Ensure valid token outside a step so the plaintext token is never
    // stored in Inngest step state (visible in the Inngest dashboard).
    const supabaseForRefresh = getSupabaseAdmin();
    const tokenResult = await ensureValidTikTokToken(platformRow, supabaseForRefresh);

    if (!tokenResult.ok) {
      console.error(
        `[sync-tiktok-videos] Token validation failed for platform ${connected_platform_id}: ${tokenResult.reason}`
      );
      return { skipped: true, reason: tokenResult.reason };
    }

    const accessToken = tokenResult.accessToken;

    // ── Step 2+: paginate through videos and upsert items ─────────────────────
    const MAX_COUNT = 20;  // TikTok Video List API max per request
    const MAX_PAGES = 50;  // cap at 1,000 videos to avoid runaway syncs

    let cursor = 0;
    let totalUpserted = 0;
    let pageIndex = 0;
    let hasMore = true;

    while (hasMore && pageIndex < MAX_PAGES) {
      const stepId = `sync-page-${cursor}`;
      const currentCursor = cursor;

      const result = await step.run(stepId, async () => {
        const supabase = getSupabaseAdmin();

        const res = await fetch("https://open.tiktokapis.com/v2/video/list/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: [
              "id",
              "title",
              "cover_image_url",
              "video_description",
              "duration",
              "create_time",
              "like_count",
              "comment_count",
              "share_count",
              "view_count",
            ],
            max_count: MAX_COUNT,
            cursor: currentCursor,
          }),
        });

        if (!res.ok) {
          throw new Error(
            `TikTok Video List API failed (${res.status}): ${await res.text()}`
          );
        }

        const body: TikTokVideoListResponse = await res.json();

        if (body.error?.code && body.error.code !== "ok") {
          throw new Error(
            `TikTok Video List API error (${body.error.code}): ${body.error.message}`
          );
        }

        const videos = body.data?.videos ?? [];

        if (videos.length === 0) {
          return { upserted: 0, hasMore: false, nextCursor: currentCursor };
        }

        // Upsert content_items rows
        const contentRows = videos.map((video) => ({
          creator_id,
          platform_id: connected_platform_id,
          platform: "tiktok" as const,
          external_id: video.id,
          title: video.title ?? null,
          body: video.video_description ?? null,
          thumbnail_url: video.cover_image_url ?? null,
          duration_seconds: video.duration ?? null,
          published_at: video.create_time
            ? new Date(video.create_time * 1000).toISOString()
            : null,
          raw_data: video,
        }));

        const { data: upsertedItems, error: contentError } = await supabase
          .from("content_items")
          .upsert(contentRows, {
            onConflict: "creator_id,platform,external_id",
          })
          .select("id, external_id");

        if (contentError) {
          throw new Error(`content_items upsert failed: ${contentError.message}`);
        }

        // Build a map from external_id → content_item id for snapshot linking
        const externalIdToItemId = new Map<string, string>(
          (upsertedItems ?? []).map((row) => [row.external_id as string, row.id as string])
        );

        // Upsert performance_snapshots for the current metrics
        const snapshotRows = videos
          .map((video) => {
            const itemId = externalIdToItemId.get(video.id);
            if (!itemId) return null;

            const views = video.view_count ?? 0;
            const likes = video.like_count ?? 0;
            const comments = video.comment_count ?? 0;
            const shares = video.share_count ?? 0;
            const engagementRate =
              views > 0 ? clamp((likes + comments + shares) / views, 0, 1) : 0;

            return {
              content_item_id: itemId,
              creator_id,
              snapshot_at: new Date().toISOString(),
              views,
              likes,
              comments,
              shares,
              engagement_rate: engagementRate,
              day_mark: null,
              raw_data: {
                view_count: video.view_count,
                like_count: video.like_count,
                comment_count: video.comment_count,
                share_count: video.share_count,
              },
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (snapshotRows.length > 0) {
          const { error: snapshotError } = await supabase
            .from("performance_snapshots")
            .upsert(snapshotRows, {
              // day_mark is null so the partial unique index doesn't apply;
              // insert fresh snapshots each sync run.
              ignoreDuplicates: false,
            });

          if (snapshotError) {
            // Non-fatal: log but don't fail the sync over snapshot errors.
            console.error(
              `[sync-tiktok-videos] performance_snapshots upsert failed: ${snapshotError.message}`
            );
          }
        }

        return {
          upserted: upsertedItems?.length ?? contentRows.length,
          hasMore: body.data?.has_more ?? false,
          nextCursor: body.data?.cursor ?? currentCursor,
        };
      });

      totalUpserted += result.upserted;
      hasMore = result.hasMore;
      cursor = result.nextCursor;
      pageIndex++;
    }

    // ── Final step: stamp last_synced_at on the connected_platforms row ───────
    await step.run("mark-synced", async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("connected_platforms")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_count: totalUpserted,
          sync_error: null,
        })
        .eq("id", connected_platform_id);
      if (error) throw new Error(`mark-synced failed: ${error.message}`);
    });

    return { creator_id, connected_platform_id, totalUpserted };
  }
);
