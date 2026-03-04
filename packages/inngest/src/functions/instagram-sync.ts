import { inngest } from "../client";
import { ensureValidInstagramToken } from "../lib/refreshInstagramToken";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── Instagram Graph API response types ───────────────────────────────────────

interface InstagramMediaListResponse {
  data: Array<{
    id: string;
    caption?: string;
    media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
    media_url?: string;
    thumbnail_url?: string;
    timestamp: string;
    permalink: string;
    like_count?: number;
    comments_count?: number;
  }>;
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the best available thumbnail URL for an Instagram media item.
 * Videos/Reels use the `thumbnail_url`; Images and Carousels use `media_url`.
 */
function pickThumbnail(item: InstagramMediaListResponse["data"][0]): string | null {
  return item.thumbnail_url ?? item.media_url ?? null;
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs all Instagram media for a connected Business/Creator account into
 * content_items.
 *
 * Triggered by: content/sync.requested  (platform === "instagram")
 *
 * The Instagram Graph API returns media in reverse chronological order.
 * We paginate through all results using cursor-based pagination, upserting
 * each media item into content_items. Duration is not available from the
 * Graph API media endpoint and is left as null.
 *
 * Steps:
 *  1. fetch-platform     – Load connected_platforms row; decrypt access token.
 *  2. sync-page-<cursor> – One step per page of media (25 items each).
 *                          Each step fetches a page and upserts rows into
 *                          content_items.
 */
export const syncInstagramMedia = inngest.createFunction(
  {
    id: "sync-instagram-media",
    name: "Sync Instagram Media",
    retries: 3,
  },
  { event: "content/sync.requested", if: "event.data.platform == 'instagram'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "instagram") {
      return { skipped: true, reason: "platform is not instagram" };
    }

    // ── Step 1: load the connected platform row ──────────────────────────────
    const platformRow = await step.run("fetch-platform", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("connected_platforms")
        .select(
          "id, access_token_enc, token_expires_at, platform_user_id"
        )
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
        token_expires_at: string | null;
        platform_user_id: string;
      };
    });

    // ── Step 1b: ensure a valid access token ─────────────────────────────────
    const tokenResult = await step.run("ensure-valid-token", async () => {
      return ensureValidInstagramToken(platformRow, getSupabaseAdmin());
    });

    if (!tokenResult.ok) {
      return {
        creator_id,
        connected_platform_id,
        skipped: true,
        reason: tokenResult.reason,
      };
    }

    const accessToken = tokenResult.accessToken;
    const igUserId = platformRow.platform_user_id;

    // ── Step 2+: paginate through media pages and upsert items ───────────────
    let cursor: string | undefined;
    let totalUpserted = 0;
    let pageIndex = 0;

    do {
      const stepId = `sync-page-${cursor ?? "initial"}`;

      const result = await step.run(stepId, async () => {
        const supabase = getSupabaseAdmin();

        const url = new URL(
          `https://graph.facebook.com/v21.0/${igUserId}/media`
        );
        url.searchParams.set(
          "fields",
          "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count"
        );
        url.searchParams.set("limit", "25");
        if (cursor) {
          url.searchParams.set("after", cursor);
        }

        const mediaRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!mediaRes.ok) {
          throw new Error(
            `Instagram media API failed (${mediaRes.status}): ${await mediaRes.text()}`
          );
        }

        const mediaData: InstagramMediaListResponse = await mediaRes.json();

        if (mediaData.data.length === 0) {
          return { nextCursor: undefined, upserted: 0 };
        }

        const rows = mediaData.data.map((item) => ({
          creator_id,
          platform_id: connected_platform_id,
          platform: "instagram" as const,
          external_id: item.id,
          title: item.caption?.split("\n")[0]?.slice(0, 255) ?? null,
          body: item.caption ?? null,
          published_at: item.timestamp,
          thumbnail_url: pickThumbnail(item),
          duration_seconds: null, // not available from the media endpoint
          raw_data: item,
        }));

        const { error, count } = await supabase
          .from("content_items")
          .upsert(rows, {
            onConflict: "creator_id,platform,external_id",
            count: "exact",
          });

        if (error) {
          throw new Error(`content_items upsert failed: ${error.message}`);
        }

        const nextCursor = mediaData.paging?.cursors?.after;
        // Only continue if there is a `next` link (cursor alone isn't enough)
        const hasNextPage = Boolean(
          mediaData.paging?.next && nextCursor
        );

        return {
          nextCursor: hasNextPage ? nextCursor : undefined,
          upserted: count ?? rows.length,
        };
      });

      cursor = result.nextCursor;
      totalUpserted += result.upserted;
      pageIndex++;

      // Safety cap: stop after 200 pages (5 000 posts) to avoid runaway syncs.
      if (pageIndex >= 200) break;
    } while (cursor);

    // ── Final step: stamp last_synced_at on the connected_platforms row ───────
    await step.run("mark-synced", async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("connected_platforms")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", connected_platform_id);
      if (error) throw new Error(`mark-synced failed: ${error.message}`);
    });

    return { creator_id, connected_platform_id, totalUpserted };
  }
);
