import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── RSS parsing helpers ──────────────────────────────────────────────────────

/**
 * Strips CDATA wrappers and trims whitespace from an RSS field value.
 */
function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

/**
 * Extracts the text content of the first occurrence of `tag` in `xml`,
 * unwrapping CDATA if present. Returns null if the tag is not found.
 */
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(re);
  return match ? stripCdata(match[1].trim()) : null;
}

/**
 * Extracts the value of `attr` from a self-closing `tag` element.
 * e.g. extractAttr(xml, "enclosure", "url") returns the enclosure URL.
 */
function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, "i");
  const match = xml.match(re);
  return match ? match[1] : null;
}

/**
 * Parses the channel-level <title> from an RSS/Atom feed.
 * Looks for the first <title> after the <channel> opening tag to skip the
 * feed-level <title> element in Atom feeds.
 */
function parseChannelTitle(xml: string): string | null {
  const channelIdx = xml.indexOf("<channel>");
  const searchXml = channelIdx !== -1 ? xml.slice(channelIdx) : xml;
  return extractTag(searchXml, "title");
}

interface ParsedRssItem {
  guid: string;
  title: string | null;
  link: string | null;
  pubDate: string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

/**
 * Splits an RSS feed into individual <item> blocks and extracts key fields.
 * Handles both RSS 2.0 and the subset of Atom that Substack emits.
 */
function parseRssItems(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];

  // Split on <item> ... </item> blocks
  const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];

    const guid =
      extractTag(block, "guid") ??
      extractTag(block, "link") ??
      "";

    if (!guid) continue; // skip malformed items

    const pubDate = extractTag(block, "pubDate") ?? extractTag(block, "published");

    // Thumbnail: prefer <media:content url="..."/>, fall back to <enclosure url="..."/>
    const thumbnailUrl =
      extractAttr(block, "media:content", "url") ??
      extractAttr(block, "enclosure", "url") ??
      null;

    items.push({
      guid,
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate,
      // Use description as the body excerpt (Substack places the subtitle/lead here)
      description: extractTag(block, "description"),
      thumbnailUrl,
    });
  }

  return items;
}

/**
 * Parses an RFC 2822 date string (as used in RSS <pubDate>) to an ISO 8601
 * string. Returns null if the date is invalid.
 */
function toIso(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Syncs publicly available Substack posts for a connected publication into
 * content_items by fetching the publication's RSS feed.
 *
 * Triggered by: content/sync.requested  (platform === "substack")
 *
 * Substack does not offer a developer API. Content is sourced from the RSS
 * feed at `{baseUrl}/feed`, which is limited to the most recent posts
 * (typically ~25). Only publicly available posts are accessible this way;
 * paid subscriber-only content is excluded.
 *
 * Steps:
 *  1. fetch-platform  – Load connected_platforms row; obtain publication URL.
 *  2. fetch-rss-feed  – Fetch and parse the RSS feed.
 *  3. upsert-items    – Upsert parsed items into content_items.
 *  4. mark-synced     – Stamp last_synced_at on the connected_platforms row.
 */
export const syncSubstackPosts = inngest.createFunction(
  {
    id: "sync-substack-posts",
    name: "Sync Substack Posts",
    retries: 3,
  },
  { event: "content/sync.requested", if: "event.data.platform == 'substack'" },
  async ({ event, step }) => {
    const { creator_id, connected_platform_id, platform } = event.data;

    if (platform !== "substack") {
      return { skipped: true, reason: "platform is not substack" };
    }

    // ── Step 1: load the connected platform row ───────────────────────────
    const platformRow = await step.run("fetch-platform", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("connected_platforms")
        .select("id, platform_user_id")
        .eq("id", connected_platform_id)
        .single();

      if (error || !data) {
        throw new Error(
          `Connected platform not found (id=${connected_platform_id}): ${error?.message}`
        );
      }

      // platform_user_id stores the canonical base URL (e.g. https://example.substack.com)
      return {
        id: data.id as string,
        baseUrl: data.platform_user_id as string,
      };
    });

    const feedUrl = `${platformRow.baseUrl}/feed`;

    // ── Step 2: fetch and parse the RSS feed ─────────────────────────────
    const parsedItems = await step.run("fetch-rss-feed", async () => {
      const res = await fetch(feedUrl, {
        headers: {
          "User-Agent":
            "Meridian/1.0 (RSS sync; +https://meridian.banton-digital.com)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(
          `Substack RSS feed fetch failed (${res.status}): ${feedUrl}`
        );
      }

      const xml = await res.text();
      return parseRssItems(xml);
    });

    if (parsedItems.length === 0) {
      return { creator_id, connected_platform_id, totalUpserted: 0 };
    }

    // ── Step 3: upsert items into content_items ───────────────────────────
    const totalUpserted = await step.run("upsert-items", async () => {
      const supabase = getSupabaseAdmin();

      const rows = parsedItems.map((item) => ({
        creator_id,
        platform_id: connected_platform_id,
        platform: "substack" as const,
        // Use the guid as the stable external identifier; fall back to link
        external_id: item.guid,
        title: item.title ?? null,
        // description holds the post excerpt / subtitle from the RSS feed
        body: item.description ?? null,
        published_at: toIso(item.pubDate),
        thumbnail_url: item.thumbnailUrl ?? null,
        duration_seconds: null,
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

      return count ?? rows.length;
    });

    // ── Step 4: stamp last_synced_at on the connected_platforms row ───────
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
