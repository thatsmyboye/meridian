import { decryptToken } from "@meridian/api";
import { inngest } from "../client";
import { ensureValidPatreonToken } from "../lib/refreshPatreonToken";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── Patreon API v2 response types ────────────────────────────────────────────

const PATREON_API_BASE = "https://www.patreon.com/api/oauth2/v2";

interface PatreonCampaignsResponse {
  data: Array<{
    id: string;
    attributes: {
      creation_name: string | null;
    };
  }>;
}

interface PatreonPost {
  id: string;
  attributes: {
    title: string | null;
    content: string | null;
    published_at: string | null;
    is_paid: boolean;
    url: string | null;
    post_type: string | null;
    /** Embed data is present on some post types (video/audio). */
    embed_data?: Record<string, unknown> | null;
  };
}

interface PatreonPostsResponse {
  data: PatreonPost[];
  meta: {
    pagination: {
      cursors?: { next?: string | null };
      total?: number;
    };
  };
  links?: {
    next?: string | null;
  };
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs a creator's Patreon posts into content_items.
 *
 * Triggered by: content/sync.requested  (platform === "patreon")
 *
 * Steps:
 *  1. fetch-platform        – Load connected_platforms row; ensure valid token.
 *  2. fetch-campaigns       – Resolve the creator's campaign ID(s).
 *     (Falls back to campaign_id stored in platform.metadata if available.)
 *  3. sync-page-<cursor>    – One step per page of posts (25 posts each).
 *                             Each step fetches posts and upserts rows into
 *                             content_items.
 *  4. mark-synced           – Stamp last_synced_at on connected_platforms.
 *
 * The access token is decrypted outside of any step so the plaintext token is
 * never serialised into Inngest's execution-state store.
 */
export const syncPatreonPosts = inngest.createFunction(
  {
    id: "sync-patreon-posts",
    name: "Sync Patreon Posts",
    retries: 3,
    onFailure: async ({ event }) => {
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
  { event: "content/sync.requested", if: "event.data.platform == 'patreon'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "patreon") {
      return { skipped: true, reason: "platform is not patreon" };
    }

    // ── Step 1: load platform row and ensure a valid access token ────────────
    const platformRow = await step.run("fetch-platform", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("connected_platforms")
        .select(
          "id, access_token_enc, refresh_token_enc, token_expires_at, metadata"
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
        metadata: Record<string, unknown> | null;
      };
    });

    // Ensure a valid token (refresh if expired). Return only ok/reason so the
    // plaintext token is never written to Inngest step state.
    const tokenResult = await step.run("ensure-valid-token", async () => {
      const result = await ensureValidPatreonToken(
        platformRow,
        getSupabaseAdmin()
      );
      if (!result.ok) return { ok: false as const, reason: result.reason };
      return { ok: true as const };
    });

    if (!tokenResult.ok) {
      return {
        creator_id,
        connected_platform_id,
        skipped: true,
        reason: tokenResult.reason,
      };
    }

    // Re-read the current access_token_enc from the DB after the token check
    // step (which may have refreshed and persisted a new token).
    const { data: freshPlatform, error: freshErr } = await getSupabaseAdmin()
      .from("connected_platforms")
      .select("access_token_enc")
      .eq("id", connected_platform_id)
      .single();

    if (freshErr || !freshPlatform) {
      throw new Error(
        `Failed to re-read platform row after token check: ${freshErr?.message}`
      );
    }

    const accessToken = decryptToken(freshPlatform.access_token_enc);

    // ── Step 2: resolve campaign ID ──────────────────────────────────────────
    // Use the campaign_id already stored in platform.metadata when available.
    // Fall back to a live API call if missing (e.g. the creator just set up a
    // campaign after connecting).
    const campaignId = await step.run("fetch-campaigns", async () => {
      const storedCampaignId = platformRow.metadata?.campaign_id as
        | string
        | null
        | undefined;

      if (storedCampaignId) return storedCampaignId;

      const res = await fetch(
        `${PATREON_API_BASE}/campaigns?fields[campaign]=creation_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        throw new Error(
          `Patreon campaigns API failed (${res.status}): ${await res.text()}`
        );
      }

      const data: PatreonCampaignsResponse = await res.json();
      const first = data.data[0];

      if (!first) {
        // Creator has no campaign — nothing to sync.
        return null;
      }

      // Persist the campaign_id so future syncs skip this API call.
      await getSupabaseAdmin()
        .from("connected_platforms")
        .update({
          metadata: {
            ...(platformRow.metadata ?? {}),
            campaign_id: first.id,
            campaign_name: first.attributes.creation_name,
          },
        })
        .eq("id", connected_platform_id);

      return first.id;
    });

    if (!campaignId) {
      // Mark synced so the /connect page spinner resolves.
      await step.run("mark-synced", async () => {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from("connected_platforms")
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_count: 0,
            sync_error: null,
          })
          .eq("id", connected_platform_id);
        if (error) throw new Error(`mark-synced failed: ${error.message}`);
      });
      return {
        creator_id,
        connected_platform_id,
        skipped: true,
        reason: "Creator has no Patreon campaign",
      };
    }

    // ── Step 3+: paginate through campaign posts and upsert items ────────────
    // Patreon uses cursor-based pagination via links.next.
    const PAGE_SIZE = 25;
    const MAX_PAGES = 200; // cap at 5 000 posts

    let cursor: string | null = null;
    let totalUpserted = 0;
    let pageIndex = 0;

    do {
      const stepId = `sync-page-${cursor ?? "initial"}`;

      const result = await step.run(stepId, async () => {
        const supabase = getSupabaseAdmin();

        const url = new URL(
          `${PATREON_API_BASE}/campaigns/${campaignId}/posts`
        );
        url.searchParams.set(
          "fields[post]",
          "title,content,published_at,is_paid,url,post_type,embed_data"
        );
        url.searchParams.set("page[count]", String(PAGE_SIZE));
        if (cursor) {
          url.searchParams.set("page[cursor]", cursor);
        }

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          if (res.status === 401) {
            // Token invalid — mark reauth and bail.
            await supabase
              .from("connected_platforms")
              .update({ status: "reauth_required" })
              .eq("id", connected_platform_id);
            return { reauthRequired: true as const, upserted: 0, nextCursor: null };
          }
          throw new Error(
            `Patreon posts API failed (${res.status}): ${await res.text()}`
          );
        }

        const body: PatreonPostsResponse = await res.json();

        if (body.data.length === 0) {
          return { upserted: 0, nextCursor: null };
        }

        // Only import published posts (those with a published_at date).
        const publishedPosts = body.data.filter(
          (post) => post.attributes.published_at != null
        );

        if (publishedPosts.length === 0) {
          const next =
            body.meta?.pagination?.cursors?.next ??
            (body.links?.next ? new URL(body.links.next).searchParams.get("page[cursor]") : null);
          return { upserted: 0, nextCursor: next ?? null };
        }

        const rows = publishedPosts.map((post) => ({
          creator_id,
          platform_id: connected_platform_id,
          platform: "patreon" as const,
          external_id: post.id,
          title: post.attributes.title ?? null,
          body: post.attributes.content ?? null,
          published_at: post.attributes.published_at,
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

        // Resolve the next cursor from the pagination links.
        const next =
          body.meta?.pagination?.cursors?.next ??
          (body.links?.next
            ? new URL(body.links.next).searchParams.get("page[cursor]")
            : null);

        return {
          upserted: count ?? rows.length,
          nextCursor: next ?? null,
        };
      });

      if ("reauthRequired" in result && result.reauthRequired) {
        return { creator_id, connected_platform_id, reauthRequired: true };
      }

      totalUpserted += result.upserted;
      cursor = result.nextCursor;
      pageIndex++;
    } while (cursor && pageIndex < MAX_PAGES);

    // ── Final step: stamp last_synced_at ──────────────────────────────────────
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
