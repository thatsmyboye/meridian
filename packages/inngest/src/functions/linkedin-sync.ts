import { decryptToken } from "@meridian/api";
import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── LinkedIn Posts REST API response types ───────────────────────────────────

/**
 * LinkedIn Posts REST API (LinkedIn-Version: 202311)
 *
 * GET /rest/posts?author={urn}&q=author&count={count}&start={start}
 *
 * This endpoint returns all posts authored by the member, including posts
 * created directly on LinkedIn.com (not just API-created UGC posts).
 */
interface LinkedInPost {
  id: string;
  author?: string;
  /** Flat post text (replaces the nested specificContent path of the old UGC API). */
  commentary?: string;
  /** "PUBLISHED" | "DRAFT" | "SCHEDULED" | "DELETED" */
  lifecycleState?: string;
  /** Millisecond-epoch timestamp when the post was published. */
  publishedAt?: number;
  /** Millisecond-epoch timestamp when the post was created. */
  createdAt?: number;
}

interface LinkedInPostsResponse {
  elements: LinkedInPost[];
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
 * Syncs a creator's LinkedIn posts into content_items.
 *
 * Triggered by: content/sync.requested  (platform === "linkedin")
 *
 * Uses the LinkedIn Posts REST API (`GET /rest/posts?q=author`) with
 * `LinkedIn-Version: 202311`. This endpoint returns all posts authored by the
 * member — including posts created directly on LinkedIn.com — unlike the
 * deprecated UGC Posts API (`/v2/ugcPosts?q=authors`) which only returned
 * posts created programmatically via the API.
 *
 * Pagination is offset-based (start / count parameters).
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

    // ── Step 2+: paginate through posts and upsert items ──────────────────────
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

        // LinkedIn Posts REST API (2023-11+). The `author` param is the
        // URL-encoded person URN. This endpoint returns all authored posts
        // (including posts created on linkedin.com), unlike the deprecated
        // /v2/ugcPosts endpoint which only returned API-created posts.
        const url = new URL("https://api.linkedin.com/rest/posts");
        url.searchParams.set("author", personUrn);
        url.searchParams.set("q", "author");
        url.searchParams.set("count", String(PAGE_SIZE));
        url.searchParams.set("start", String(start));

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "LinkedIn-Version": "202311",
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            const body = await res.text();
            console.error(
              `[sync-linkedin-posts] Auth error (${res.status}) for platform ${connected_platform_id}: ${body}`
            );
            // Return a sentinel instead of throwing — auth errors are not
            // retryable. The outer handler will mark the platform reauth_required.
            return { reauthRequired: true as const, upserted: 0, hasMore: false, nextStart: start };
          }
          throw new Error(
            `LinkedIn Posts API failed (${res.status}): ${await res.text()}`
          );
        }

        const body: LinkedInPostsResponse = await res.json();

        if (body.elements.length === 0) {
          return { upserted: 0, hasMore: false, nextStart: start };
        }

        // Only import published posts; skip drafts and scheduled posts.
        const publishedPosts = body.elements.filter(
          (post) => !post.lifecycleState || post.lifecycleState === "PUBLISHED"
        );

        if (publishedPosts.length === 0) {
          const nextStart = start + body.elements.length;
          const more = nextStart < body.paging.total && body.elements.length > 0;
          return { upserted: 0, hasMore: more, nextStart };
        }

        const rows = publishedPosts.map((post) => ({
          creator_id,
          platform_id: connected_platform_id,
          platform: "linkedin" as const,
          external_id: post.id,
          title: post.commentary?.split("\n")[0]?.slice(0, 255) ?? null,
          body: post.commentary ?? null,
          published_at: millisToIso(post.publishedAt ?? post.createdAt),
          thumbnail_url: null,
          duration_seconds: null,
          raw_data: post,
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

        const nextStart = start + body.elements.length;
        const more = nextStart < body.paging.total && body.elements.length > 0;

        return {
          upserted: count ?? rows.length,
          hasMore: more,
          nextStart,
        };
      });

      if ("reauthRequired" in result && result.reauthRequired) {
        const supabase = getSupabaseAdmin();
        const { error: reauthErr } = await supabase
          .from("connected_platforms")
          .update({ status: "reauth_required" })
          .eq("id", connected_platform_id);
        if (reauthErr) {
          console.error(
            `[sync-linkedin-posts] Failed to set reauth_required for platform ${connected_platform_id}: ${reauthErr.message}`
          );
        }
        return { creator_id, connected_platform_id, reauthRequired: true };
      }

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
