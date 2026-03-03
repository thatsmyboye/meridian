import { createClient } from "@supabase/supabase-js";
import { inngest } from "../client";
import { ensureValidYouTubeToken } from "../lib/refreshYouTubeToken";

// ─── YouTube API response types ───────────────────────────────────────────────

interface ChannelsResponse {
  items?: Array<{
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }>;
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items: Array<{
    contentDetails: { videoId: string };
  }>;
}

interface VideosListResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      publishedAt: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails: {
      duration: string; // ISO 8601 e.g. "PT4M13S"
    };
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts an ISO 8601 duration string (e.g. "PT4M13S") to total seconds.
 * Returns 0 for unrecognised formats.
 */
function parseDuration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return (
    parseInt(match[1] ?? "0", 10) * 3600 +
    parseInt(match[2] ?? "0", 10) * 60 +
    parseInt(match[3] ?? "0", 10)
  );
}

/** Returns the best available thumbnail URL from a YouTube thumbnails object. */
function pickThumbnail(
  thumbnails: VideosListResponse["items"][0]["snippet"]["thumbnails"]
): string | null {
  return (
    thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null
  );
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs all YouTube video metadata for a connected channel into content_items.
 *
 * Triggered by: content/sync.requested  (platform === "youtube")
 *
 * Steps:
 *  1. fetch-platform     – Load connected_platforms row; decrypt access token.
 *  2. fetch-uploads-playlist – Get the channel's uploads playlist ID.
 *  3. sync-page-<token>  – One step per playlist page (50 videos each).
 *                          Each step fetches full video details and upserts
 *                          rows into content_items.
 */
export const syncYoutubeMetadata = inngest.createFunction(
  {
    id: "sync-youtube-metadata",
    name: "Sync YouTube Video Metadata",
    retries: 3,
  },
  { event: "content/sync.requested", if: "event.data.platform == 'youtube'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "youtube") {
      return { skipped: true, reason: "platform is not youtube" };
    }

    // ── Step 1: load the connected platform row ──────────────────────────────
    const platformRow = await step.run("fetch-platform", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("connected_platforms")
        .select(
          "id, access_token_enc, refresh_token_enc, token_expires_at, platform_user_id"
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
        refresh_token_enc: string | null;
        token_expires_at: string | null;
        platform_user_id: string;
      };
    });

    // ── Step 1b: ensure a valid access token before making API calls ─────────
    // Checks expiry (5-minute buffer) and refreshes via Google if needed.
    // On refresh failure, marks the platform as reauth_required and returns
    // early — we do NOT throw so Inngest skips retries that would burn quota.
    const tokenResult = await step.run("ensure-valid-token", async () => {
      return ensureValidYouTubeToken(platformRow, getSupabaseAdmin());
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

    // ── Step 2: resolve the channel's uploads playlist ID ───────────────────
    const uploadsPlaylistId = await step.run(
      "fetch-uploads-playlist",
      async () => {
        const url = new URL(
          "https://www.googleapis.com/youtube/v3/channels"
        );
        url.searchParams.set("part", "contentDetails");
        url.searchParams.set("id", platformRow.platform_user_id);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          throw new Error(
            `YouTube channels API failed (${res.status}): ${await res.text()}`
          );
        }

        const data: ChannelsResponse = await res.json();
        const uploads =
          data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploads) {
          throw new Error(
            `No uploads playlist found for channel ${platformRow.platform_user_id}`
          );
        }
        return uploads;
      }
    );

    // ── Step 3+: paginate through playlist pages and upsert videos ───────────
    let pageToken: string | undefined;
    let totalUpserted = 0;

    do {
      const stepId = `sync-page-${pageToken ?? "initial"}`;

      const result = await step.run(stepId, async () => {
        const supabase = getSupabaseAdmin();

        // 3a. List video IDs from the uploads playlist
        const playlistUrl = new URL(
          "https://www.googleapis.com/youtube/v3/playlistItems"
        );
        playlistUrl.searchParams.set("part", "contentDetails");
        playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
        playlistUrl.searchParams.set("maxResults", "50");
        if (pageToken) {
          playlistUrl.searchParams.set("pageToken", pageToken);
        }

        const playlistRes = await fetch(playlistUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!playlistRes.ok) {
          throw new Error(
            `YouTube playlistItems API failed (${playlistRes.status}): ${await playlistRes.text()}`
          );
        }

        const playlistData: PlaylistItemsResponse = await playlistRes.json();
        const videoIds = playlistData.items.map(
          (item) => item.contentDetails.videoId
        );

        if (videoIds.length === 0) {
          return { nextPageToken: undefined, upserted: 0 };
        }

        // 3b. Fetch full metadata for this batch of video IDs
        const videosUrl = new URL(
          "https://www.googleapis.com/youtube/v3/videos"
        );
        videosUrl.searchParams.set("part", "snippet,contentDetails");
        videosUrl.searchParams.set("id", videoIds.join(","));

        const videosRes = await fetch(videosUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!videosRes.ok) {
          throw new Error(
            `YouTube videos API failed (${videosRes.status}): ${await videosRes.text()}`
          );
        }

        const videosData: VideosListResponse = await videosRes.json();

        // 3c. Upsert rows into content_items
        const rows = videosData.items.map((video) => ({
          creator_id,
          platform_id: connected_platform_id,
          platform: "youtube" as const,
          external_id: video.id,
          title: video.snippet.title,
          published_at: video.snippet.publishedAt,
          thumbnail_url: pickThumbnail(video.snippet.thumbnails),
          duration_seconds: parseDuration(video.contentDetails.duration),
          raw_data: video,
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

        return {
          nextPageToken: playlistData.nextPageToken,
          upserted: count ?? rows.length,
        };
      });

      pageToken = result.nextPageToken;
      totalUpserted += result.upserted;
    } while (pageToken);

    return { creator_id, connected_platform_id, totalUpserted };
  }
);
