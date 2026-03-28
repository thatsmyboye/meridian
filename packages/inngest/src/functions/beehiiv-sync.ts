import { decryptToken } from "@meridian/api";
import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── Beehiiv API v2 response types ───────────────────────────────────────────

interface BeehiivPost {
  id: string;
  publication_id: string;
  title: string;
  subtitle: string | null;
  status: string;
  /** Unix timestamp (seconds) of when the post was published. */
  publish_date: number | null;
  displayed_date: number | null;
  slug: string;
  thumbnail_url: string | null;
  web_url: string | null;
  audience: string;
}

interface BeehiivPostsResponse {
  data: BeehiivPost[];
  page: number;
  limit: number;
  total_results: number;
  total_pages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a Beehiiv Unix timestamp (seconds) to an ISO 8601 string.
 * Returns null if the timestamp is missing or zero.
 */
function toIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs all published Beehiiv newsletter posts for a connected publication
 * into content_items.
 *
 * Triggered by: content/sync.requested  (platform === "beehiiv")
 *
 * Beehiiv uses API key authentication (no OAuth / token refresh). The
 * encrypted API key is stored in access_token_enc; decrypted here for use.
 *
 * Only posts with status === "confirmed" (published) are imported. Posts
 * are fetched page-by-page (100 per page) until all pages are exhausted.
 *
 * Steps:
 *  1. fetch-platform          – Load connected_platforms row; decrypt API key.
 *  2. sync-page-<N>           – One step per page of posts (100 items each).
 *                               Each step upserts a batch into content_items.
 */
export const syncBeehiivPosts = inngest.createFunction(
  {
    id: "sync-beehiiv-posts",
    name: "Sync Beehiiv Newsletter Posts",
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
  { event: "content/sync.requested", if: "event.data.platform == 'beehiiv'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "beehiiv") {
      return { skipped: true, reason: "platform is not beehiiv" };
    }

    // ── Step 1: load the connected platform row and decrypt the API key ──────
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

      return {
        id: data.id as string,
        access_token_enc: data.access_token_enc as string,
        publicationId: data.platform_user_id as string,
      };
    });

    // Decrypt outside the step so the plaintext key is never stored in Inngest
    // step state (which is visible in the Inngest dashboard).
    const apiKey = decryptToken(platformRow.access_token_enc);
    const { publicationId } = platformRow;

    // ── Step 2+: paginate through published posts and upsert into content_items
    let page = 1;
    let totalPages = 1; // updated after the first response
    let totalUpserted = 0;
    // Safety cap: stop after 100 pages (10 000 posts) to avoid runaway syncs.
    const MAX_PAGES = 100;

    do {
      const currentPage = page;

      const result = await step.run(`sync-page-${currentPage}`, async () => {
        const supabase = getSupabaseAdmin();

        const url = new URL(
          `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}/posts`
        );
        url.searchParams.set("status", "confirmed");
        url.searchParams.set("limit", "100");
        url.searchParams.set("page", String(currentPage));

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(
            `Beehiiv posts API failed (${res.status}): ${await res.text()}`
          );
        }

        const body: BeehiivPostsResponse = await res.json();

        if (body.data.length === 0) {
          return { upserted: 0, totalPages: body.total_pages };
        }

        const rows = body.data.map((post) => ({
          creator_id,
          platform_id: connected_platform_id,
          platform: "beehiiv" as const,
          external_id: post.id,
          title: post.title ?? null,
          body: post.subtitle ?? null,
          published_at: toIso(post.publish_date ?? post.displayed_date),
          thumbnail_url: post.thumbnail_url ?? null,
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

        return { upserted: count ?? rows.length, totalPages: body.total_pages };
      });

      totalPages = result.totalPages;
      totalUpserted += result.upserted;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);

    // ── Final step: stamp last_synced_at on the connected_platforms row ───────
    await step.run("mark-synced", async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("connected_platforms")
        .update({ last_synced_at: new Date().toISOString(), last_sync_count: totalUpserted, sync_error: null })
        .eq("id", connected_platform_id);
      if (error) throw new Error(`mark-synced failed: ${error.message}`);
    });

    return { creator_id, connected_platform_id, totalUpserted };
  }
);
