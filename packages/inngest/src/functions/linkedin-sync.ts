import { decryptToken } from "@meridian/api";
import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── LinkedIn UGC Posts API response types ────────────────────────────────────

interface UgcPostShareContent {
  shareCommentary?: { text?: string };
}

interface UgcPost {
  id: string;
  specificContent?: {
    "com.linkedin.ugc.ShareContent"?: UgcPostShareContent;
  };
  created?: { time?: number };
  lastModified?: { time?: number };
}

interface UgcPostsResponse {
  elements: UgcPost[];
  paging: {
    total: number;
    count: number;
    start: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a LinkedIn millisecond-epoch timestamp to an ISO 8601 string.
 * Returns null when the value is absent.
 */
function millisToIso(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs a creator's LinkedIn UGC posts into content_items.
 *
 * Triggered by: content/sync.requested  (platform === "linkedin")
 *
 * The LinkedIn UGC Posts API (`GET /v2/ugcPosts?q=authors`) uses offset-based
 * pagination. We page through results upserting each post into content_items.
 *
 * Steps:
 *  1. fetch-platform      – Load connected_platforms row.
 *  2. sync-page-<start>   – One step per page (50 posts each).
 *                           Each step fetches a page and upserts rows into
 *                           content_items.
 *  3. mark-synced         – Stamp last_synced_at on connected_platforms.
 *
 * Note: The access token is decrypted outside of any step so that the
 * plaintext token is never serialised into Inngest step state.
 */
export const syncLinkedInPosts = inngest.createFunction(
  {
    id: "sync-linkedin-posts",
    name: "Sync LinkedIn Posts",
    retries: 3,
  },
  { event: "content/sync.requested", if: "event.data.platform == 'linkedin'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "linkedin") {
      return { skipped: true, reason: "platform is not linkedin" };
    }

    // ── Step 1: load the connected platform row ──────────────────────────────
    const platformRow = await step.run("fetch-platform", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("connected_platforms")
        .select("id, access_token_enc, platform_user_id")
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
        platform_user_id: string;
      };
    });

    // Decrypt outside a step so the plaintext token is never stored in
    // Inngest step state (visible in the Inngest dashboard).
    const accessToken = decryptToken(platformRow.access_token_enc);

    // Normalise the person URN – stored either as a bare numeric ID or as
    // the full "urn:li:person:{id}" format.
    const personUrn = platformRow.platform_user_id.startsWith("urn:li:")
      ? platformRow.platform_user_id
      : `urn:li:person:${platformRow.platform_user_id}`;

    // ── Step 2+: paginate through UGC posts and upsert items ──────────────────
    const PAGE_SIZE = 50;
    const MAX_PAGES = 100; // cap at 5 000 posts to avoid runaway syncs

    let start = 0;
    let totalUpserted = 0;
    let pageIndex = 0;
    let hasMore = true;

    while (hasMore && pageIndex < MAX_PAGES) {
      const stepId = `sync-page-${start}`;

      const result = await step.run(stepId, async () => {
        const supabase = getSupabaseAdmin();

        const url = new URL("https://api.linkedin.com/v2/ugcPosts");
        url.searchParams.set("q", "authors");
        url.searchParams.set("authors", `List(${personUrn})`);
        url.searchParams.set("start", String(start));
        url.searchParams.set("count", String(PAGE_SIZE));

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });

        if (!res.ok) {
          throw new Error(
            `LinkedIn UGC Posts API failed (${res.status}): ${await res.text()}`
          );
        }

        const body: UgcPostsResponse = await res.json();

        if (body.elements.length === 0) {
          return { upserted: 0, hasMore: false, nextStart: start };
        }

        const rows = body.elements.map((post) => {
          const text =
            post.specificContent?.["com.linkedin.ugc.ShareContent"]
              ?.shareCommentary?.text ?? null;
          return {
            creator_id,
            platform_id: connected_platform_id,
            platform: "linkedin" as const,
            external_id: post.id,
            title: text?.split("\n")[0]?.slice(0, 255) ?? null,
            body: text,
            published_at: millisToIso(post.created?.time),
            thumbnail_url: null,
            duration_seconds: null,
            raw_data: post,
          };
        });

        const { error, count } = await supabase
          .from("content_items")
          .upsert(rows, {
            onConflict: "creator_id,platform,external_id",
            count: "exact",
          });

        if (error) {
          throw new Error(`content_items upsert failed: ${error.message}`);
        }

        const nextStart = start + body.elements.length;
        const more = nextStart < body.paging.total && body.elements.length > 0;

        return {
          upserted: count ?? rows.length,
          hasMore: more,
          nextStart,
        };
      });

      totalUpserted += result.upserted;
      hasMore = result.hasMore;
      start = result.nextStart;
      pageIndex++;
    }

    // ── Final step: stamp last_synced_at on the connected_platforms row ───────
    await step.run("mark-synced", async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("connected_platforms")
        .update({ last_synced_at: new Date().toISOString(), last_sync_count: totalUpserted })
        .eq("id", connected_platform_id);
      if (error) throw new Error(`mark-synced failed: ${error.message}`);
    });

    return { creator_id, connected_platform_id, totalUpserted };
  }
);
