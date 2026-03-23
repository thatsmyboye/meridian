"use server";

/**
 * Server action for connecting a Substack publication.
 *
 * Substack does not provide a first-party API. Content is imported via the
 * publication's public RSS feed (`{baseUrl}/feed`). No API key is required.
 *
 * The creator supplies their publication URL; we validate it by fetching the
 * RSS feed and extract the publication name from the channel title.
 *
 * Using a server action (vs. a plain API route) provides built-in CSRF
 * protection: Next.js validates the Origin header against the host and signs
 * the action ID, making cross-site form submissions impossible without the
 * valid action token.
 */

import { redirect } from "next/navigation";
import { encryptToken } from "@meridian/api";
import { inngest } from "@meridian/inngest";
import { createServerClient } from "@/lib/supabase/server";
import { getCreatorSubscription, checkPlatformLimit } from "@/lib/subscription";

/**
 * Normalises a user-supplied Substack URL to a canonical base URL.
 * Strips trailing slashes; ensures the protocol is present.
 * Returns null if the input is not a plausible URL.
 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  // Accept bare subdomain inputs like "example.substack.com"
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    // Only allow http(s) schemes
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Extracts the channel <title> from a raw RSS/Atom XML string.
 * Returns null if the title cannot be found.
 */
function extractRssChannelTitle(xml: string): string | null {
  // Strip the feed-level <title> by looking for the first one after <channel>
  const channelStart = xml.indexOf("<channel>");
  if (channelStart === -1) return null;
  const channelXml = xml.slice(channelStart);
  const match = channelXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  return match ? match[1].trim() : null;
}

export async function connectSubstack(_formData: FormData) {
  // TypeScript 5.9+ merges the DOM FormData and @types/node v22 FormData
  // declarations into an incompatible intersection where .get() is absent.
  // Casting through unknown to a minimal interface resolves the ambiguity.
  const formData = _formData as unknown as { get(name: string): string | null };
  const rawUrl = formData.get("publication_url")?.trim();

  if (!rawUrl) {
    redirect("/connect/substack?error=missing_params");
  }

  const baseUrl = normalizeUrl(rawUrl);
  if (!baseUrl) {
    redirect("/connect/substack?error=invalid_url");
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connect/substack?error=unauthenticated");
  }

  // ── Platform limit gate ───────────────────────────────────────────────────
  const subscription = await getCreatorSubscription();
  if (subscription) {
    const limitCheck = await checkPlatformLimit(
      subscription.creatorId,
      subscription.tier
    );
    if (!limitCheck.allowed) {
      // Only block if Substack is not already connected (allow re-connect/update)
      const { count } = await supabase
        .from("connected_platforms")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", subscription.creatorId)
        .eq("platform", "substack");
      if ((count ?? 0) === 0) {
        redirect("/connect?error=platform_limit_reached");
      }
    }
  }

  // ── Validate by fetching the RSS feed ────────────────────────────────────
  const feedUrl = `${baseUrl}/feed`;
  let publicationName: string | null = null;

  try {
    const feedRes = await fetch(feedUrl, {
      headers: {
        // Identify ourselves politely; Substack's CDN may block bare fetches
        "User-Agent": "Meridian/1.0 (RSS validator; +https://meridian.banton-digital.com)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      // Enforce a reasonable timeout via AbortSignal
      signal: AbortSignal.timeout(10_000),
    });

    if (!feedRes.ok) {
      console.error(
        "[substack/connect] RSS feed fetch failed:",
        feedRes.status,
        feedUrl
      );
      redirect("/connect/substack?error=invalid_url");
    }

    const xml = await feedRes.text();

    // A valid RSS feed must contain <rss or <feed (Atom)
    if (!xml.includes("<rss") && !xml.includes("<feed")) {
      console.error("[substack/connect] Response does not look like RSS:", feedUrl);
      redirect("/connect/substack?error=invalid_url");
    }

    publicationName = extractRssChannelTitle(xml);
  } catch (err) {
    console.error("[substack/connect] RSS fetch error:", err);
    redirect("/connect/substack?error=invalid_url");
  }

  // ── Creator lookup ────────────────────────────────────────────────────────
  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) {
    console.error("[substack/connect] Creator lookup failed:", creatorErr?.message);
    redirect("/connect/substack?error=creator_not_found");
  }

  // Store the base URL encrypted so it's consistent with how other
  // non-OAuth credentials (like Beehiiv API keys) are handled.
  const accessTokenEnc = encryptToken(baseUrl);

  const { data: platformData, error: upsertErr } = await supabase
    .from("connected_platforms")
    .upsert(
      {
        creator_id: creator.id,
        platform: "substack",
        // platform_user_id stores the canonical base URL, used by the sync
        // function to construct the RSS feed URL.
        platform_user_id: baseUrl,
        platform_username: publicationName ?? baseUrl,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: null,
        token_expires_at: null,
        scopes: [],
        status: "active",
      },
      { onConflict: "creator_id,platform" }
    )
    .select("id")
    .single();

  if (upsertErr || !platformData) {
    console.error("[substack/connect] Upsert failed:", upsertErr?.message);
    redirect("/connect/substack?error=save_failed");
  }

  try {
    await inngest.send({
      name: "platform/connected",
      data: {
        creator_id: creator.id,
        platform: "substack",
        connected_platform_id: platformData.id,
      },
    });
  } catch (err) {
    console.error("[substack/connect] inngest.send failed:", err);
  }

  redirect("/connect?success=substack");
}
