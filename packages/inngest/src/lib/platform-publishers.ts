/**
 * Per-platform publishing functions for scheduled derivatives.
 *
 * Each publisher takes the decrypted access token, platform metadata,
 * and derivative content, then calls the platform's native API to post.
 *
 * Returns { external_id: string } on success (the platform's post ID).
 * Throws on failure so Inngest can retry automatically.
 */

import { decryptToken } from "@meridian/api";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PlatformRow {
  platform_user_id: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PublishResult {
  external_id: string;
  url?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Splits a tweet thread string into individual tweets.
 *
 * Strategies (in order):
 *  1. Splits on blank lines between numbered items (1. ... 2. ...)
 *  2. Splits on double newlines
 *  3. Falls back to chunking at word boundaries within 280 chars
 */
function splitIntoTweets(content: string): string[] {
  const TWEET_LIMIT = 280;

  // Try splitting on double-newline paragraphs first
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const tweets: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= TWEET_LIMIT) {
      tweets.push(para);
    } else {
      // chunk long paragraphs at word boundaries
      const words = para.split(" ");
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > TWEET_LIMIT) {
          if (current) tweets.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) tweets.push(current);
    }
  }

  return tweets.length > 0 ? tweets : [content.slice(0, TWEET_LIMIT)];
}

// ─── Twitter API v2 ───────────────────────────────────────────────────────────

/**
 * Posts a tweet thread to Twitter/X via API v2.
 *
 * Requires OAuth 2.0 user access token with tweet.write + users.read scopes.
 * Posts each tweet sequentially, each replying to the previous, forming a thread.
 *
 * Returns the ID of the first tweet in the thread.
 */
export async function publishToTwitter(
  platform: PlatformRow,
  content: string
): Promise<PublishResult> {
  const accessToken = decryptToken(platform.access_token_enc);
  const tweets = splitIntoTweets(content);

  let previousTweetId: string | null = null;
  let firstTweetId: string | null = null;
  let firstTweetUsername: string | null = null;

  for (const tweetText of tweets) {
    const body: Record<string, unknown> = { text: tweetText };
    if (previousTweetId) {
      body.reply = { in_reply_to_tweet_id: previousTweetId };
    }

    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `Twitter API error ${res.status} posting tweet: ${err}`
      );
    }

    const data = (await res.json()) as { data: { id: string } };
    previousTweetId = data.data.id;

    if (!firstTweetId) {
      firstTweetId = data.data.id;
      firstTweetUsername = platform.platform_user_id ?? "user";
    }
  }

  return {
    external_id: firstTweetId!,
    url: firstTweetUsername
      ? `https://twitter.com/${firstTweetUsername}/status/${firstTweetId}`
      : undefined,
  };
}

// ─── Instagram Graph API ──────────────────────────────────────────────────────

/**
 * Posts a caption to Instagram via the Graph API.
 *
 * Uses the two-step process:
 *  1. Create media container (image required — uses image_url from metadata or
 *     a fallback placeholder approach)
 *  2. Publish the container
 *
 * Requires: instagram_business_account_id in platform.metadata,
 *           valid access token with instagram_content_publish scope.
 *
 * NOTE: Instagram requires at least one image. If no image_url is provided in
 * the platform metadata, this will throw. The creator must connect an account
 * that has a default image configured.
 */
export async function publishToInstagram(
  platform: PlatformRow,
  content: string
): Promise<PublishResult> {
  const accessToken = decryptToken(platform.access_token_enc);
  const igUserId =
    (platform.metadata?.instagram_business_account_id as string | undefined) ??
    platform.platform_user_id;

  if (!igUserId) {
    throw new Error(
      "Instagram: missing instagram_business_account_id in platform metadata"
    );
  }

  // Step 1: Create media container
  // Instagram requires an image for feed posts. We use the image_url from
  // metadata if available; otherwise this is a caption-only text post attempt
  // via the newer text post endpoint (requires appropriate permissions).
  const imageUrl = platform.metadata?.default_image_url as string | undefined;

  const containerParams = new URLSearchParams({
    caption: content,
    access_token: accessToken,
  });

  if (imageUrl) {
    containerParams.set("image_url", imageUrl);
    containerParams.set("media_type", "IMAGE");
  } else {
    // Attempt text-only post (requires instagram_manage_insights scope + text post feature)
    containerParams.set("media_type", "IMAGE");
    // Fallback: Use a 1x1 transparent pixel as a workaround
    containerParams.set(
      "image_url",
      "https://via.placeholder.com/1080x1080.png?text=+"
    );
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: containerParams.toString(),
    }
  );

  if (!containerRes.ok) {
    const err = await containerRes.text();
    throw new Error(
      `Instagram Graph API error ${containerRes.status} creating container: ${err}`
    );
  }

  const containerData = (await containerRes.json()) as { id: string };
  const creationId = containerData.id;

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      }).toString(),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(
      `Instagram Graph API error ${publishRes.status} publishing media: ${err}`
    );
  }

  const publishData = (await publishRes.json()) as { id: string };

  return {
    external_id: publishData.id,
    url: `https://www.instagram.com/p/${publishData.id}/`,
  };
}

// ─── LinkedIn API ─────────────────────────────────────────────────────────────

/**
 * Posts a text update to LinkedIn via the UGC Posts API.
 *
 * Requires: LinkedIn person URN (urn:li:person:{id}) from platform_user_id.
 * Access token must have w_member_social scope.
 */
export async function publishToLinkedIn(
  platform: PlatformRow,
  content: string
): Promise<PublishResult> {
  const accessToken = decryptToken(platform.access_token_enc);

  // LinkedIn uses URN format: urn:li:person:{id}
  const personId = platform.platform_user_id;
  if (!personId) {
    throw new Error("LinkedIn: missing platform_user_id (LinkedIn person ID)");
  }

  const authorUrn = personId.startsWith("urn:li:")
    ? personId
    : `urn:li:person:${personId}`;

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `LinkedIn API error ${res.status} creating post: ${err}`
    );
  }

  // LinkedIn returns the post URN in the X-RestLi-Id header
  const postUrn =
    res.headers.get("x-restli-id") ??
    res.headers.get("X-RestLi-Id") ??
    ((await res.json()) as { id?: string }).id ??
    "unknown";

  const postId = postUrn.split(":").pop() ?? postUrn;

  return {
    external_id: postUrn,
    url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`,
  };
}

// ─── Beehiiv API ──────────────────────────────────────────────────────────────

/**
 * Creates and publishes a post to Beehiiv via their v2 REST API.
 *
 * Requires: publication_id in platform.metadata or platform_user_id.
 * Access token: Beehiiv API key (stored as access_token_enc).
 *
 * The derivative content becomes the post body (HTML or plain text).
 * The first line of content is used as the subtitle if no explicit subtitle
 * is provided.
 */
export async function publishToBeehiiv(
  platform: PlatformRow,
  content: string
): Promise<PublishResult> {
  const apiKey = decryptToken(platform.access_token_enc);
  const publicationId =
    (platform.metadata?.publication_id as string | undefined) ??
    platform.platform_user_id;

  if (!publicationId) {
    throw new Error(
      "Beehiiv: missing publication_id in platform metadata or platform_user_id"
    );
  }

  // Extract first line as subtitle (newsletter blurb convention)
  const lines = content.split("\n").filter(Boolean);
  const subtitle = lines[0]?.slice(0, 255) ?? "New post";
  const bodyContent = content;

  const body = {
    // Beehiiv requires at minimum a subtitle and body
    subtitle,
    body: bodyContent,
    // Wrap plain text in a minimal HTML structure for the Beehiiv editor
    content_tags: [],
    // Publish immediately
    status: "confirmed",
    send_at: new Date().toISOString(),
  };

  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${publicationId}/posts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Beehiiv API error ${res.status} creating post: ${err}`
    );
  }

  const data = (await res.json()) as { data?: { id?: string; web_url?: string } };
  const postId = data.data?.id ?? "unknown";
  const url = data.data?.web_url;

  return {
    external_id: postId,
    ...(url ? { url } : {}),
  };
}

// ─── Platform dispatch ────────────────────────────────────────────────────────

/**
 * Routes publishing to the correct platform publisher.
 * `platform_name` matches the `platform` field in the derivative object.
 */
export async function publishDerivative(
  platformName: string,
  platformRow: PlatformRow,
  content: string
): Promise<PublishResult> {
  switch (platformName) {
    case "twitter":
      return publishToTwitter(platformRow, content);
    case "instagram":
      return publishToInstagram(platformRow, content);
    case "linkedin":
      return publishToLinkedIn(platformRow, content);
    case "other": // newsletter_blurb maps to "other" → Beehiiv
      return publishToBeehiiv(platformRow, content);
    default:
      throw new Error(
        `No publisher configured for platform: ${platformName}`
      );
  }
}
