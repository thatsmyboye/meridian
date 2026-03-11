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

/**
 * A single item in an Instagram carousel post.
 * Supports both image and video media types.
 */
export interface CarouselItem {
  /** Publicly accessible URL for the image or video. */
  url: string;
  /** Media type of the item. Defaults to IMAGE if omitted. */
  media_type?: "IMAGE" | "VIDEO";
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

const IG_GRAPH_BASE = "https://graph.facebook.com/v21.0";

/**
 * Polls an Instagram media container until its status_code is FINISHED or
 * until the timeout is reached. Required before creating a CAROUSEL container
 * when one or more carousel items are videos (videos need processing time).
 *
 * Throws if the container enters an ERROR/EXPIRED state or times out.
 */
async function pollContainerUntilFinished(
  containerId: string,
  accessToken: string,
  timeoutMs = 120_000,
  intervalMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${IG_GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `Instagram: failed to poll container ${containerId} status: ${err}`
      );
    }

    const data = (await res.json()) as { status_code?: string };
    const statusCode = data.status_code;

    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(
        `Instagram: carousel item container ${containerId} entered ${statusCode} state`
      );
    }

    // IN_PROGRESS — wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Instagram: timed out waiting for container ${containerId} to finish processing`
  );
}

/**
 * Posts a single-image caption to Instagram via the Graph API.
 *
 * Uses the two-step process:
 *  1. Create media container (image required — uses image_url from metadata or
 *     a fallback placeholder)
 *  2. Publish the container
 *
 * Requires: instagram_business_account_id in platform.metadata,
 *           valid access token with instagram_content_publish scope.
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
  // metadata if available; otherwise fall back to the self-hosted placeholder.
  const imageUrl = platform.metadata?.default_image_url as string | undefined;

  const containerParams = new URLSearchParams({
    caption: content,
    access_token: accessToken,
    media_type: "IMAGE",
  });

  if (imageUrl) {
    containerParams.set("image_url", imageUrl);
  } else {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://meridian.banton-digital.com";
    containerParams.set("image_url", `${appUrl}/instagram-placeholder.png`);
  }

  const containerRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: containerParams.toString(),
  });

  if (!containerRes.ok) {
    const err = await containerRes.text();
    throw new Error(
      `Instagram Graph API error ${containerRes.status} creating container: ${err}`
    );
  }

  const containerData = (await containerRes.json()) as { id: string };
  const creationId = containerData.id;

  // Step 2: Publish the container
  const publishRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    }).toString(),
  });

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

/**
 * Posts a carousel (multi-image/video) post to Instagram via the Graph API.
 *
 * The three-step process:
 *  1. Create individual item containers for each media item
 *     (POST /{ig-user-id}/media with is_carousel_item=true per item)
 *  2. Wait for video item containers to finish processing (if any)
 *  3. Create the carousel container referencing all child container IDs
 *     (POST /{ig-user-id}/media with media_type=CAROUSEL)
 *  4. Publish the carousel container
 *     (POST /{ig-user-id}/media_publish)
 *
 * Requires:
 *   - instagram_business_account_id in platform.metadata
 *   - valid access token with instagram_content_publish scope
 *   - 2–10 publicly accessible image/video URLs in carouselItems
 *
 * Instagram carousel limits:
 *   - Minimum 2 items, maximum 10 items per carousel
 *   - Images: JPEG only (JPEGs with extended formats not allowed)
 *   - Videos: must be in a supported format (MP4 recommended)
 */
export async function publishInstagramCarousel(
  platform: PlatformRow,
  caption: string,
  carouselItems: CarouselItem[]
): Promise<PublishResult> {
  if (carouselItems.length < 2) {
    throw new Error(
      "Instagram carousel requires at least 2 media items"
    );
  }
  if (carouselItems.length > 10) {
    throw new Error(
      "Instagram carousel supports a maximum of 10 media items"
    );
  }

  const accessToken = decryptToken(platform.access_token_enc);
  const igUserId =
    (platform.metadata?.instagram_business_account_id as string | undefined) ??
    platform.platform_user_id;

  if (!igUserId) {
    throw new Error(
      "Instagram: missing instagram_business_account_id in platform metadata"
    );
  }

  // Step 1: Create individual item containers
  const itemContainerIds: string[] = [];
  const videoContainerIds: string[] = [];

  for (const item of carouselItems) {
    const mediaType = item.media_type ?? "IMAGE";
    const itemParams = new URLSearchParams({
      is_carousel_item: "true",
      media_type: mediaType,
      access_token: accessToken,
    });

    if (mediaType === "VIDEO") {
      itemParams.set("video_url", item.url);
    } else {
      itemParams.set("image_url", item.url);
    }

    const itemRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: itemParams.toString(),
    });

    if (!itemRes.ok) {
      const err = await itemRes.text();
      throw new Error(
        `Instagram Graph API error ${itemRes.status} creating carousel item container: ${err}`
      );
    }

    const itemData = (await itemRes.json()) as { id: string };
    itemContainerIds.push(itemData.id);

    if (mediaType === "VIDEO") {
      videoContainerIds.push(itemData.id);
    }
  }

  // Step 2: Wait for video containers to finish processing
  for (const videoContainerId of videoContainerIds) {
    await pollContainerUntilFinished(videoContainerId, accessToken);
  }

  // Step 3: Create the carousel container
  const carouselParams = new URLSearchParams({
    media_type: "CAROUSEL",
    children: itemContainerIds.join(","),
    caption,
    access_token: accessToken,
  });

  const carouselRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: carouselParams.toString(),
  });

  if (!carouselRes.ok) {
    const err = await carouselRes.text();
    throw new Error(
      `Instagram Graph API error ${carouselRes.status} creating carousel container: ${err}`
    );
  }

  const carouselData = (await carouselRes.json()) as { id: string };
  const carouselContainerId = carouselData.id;

  // Step 4: Publish the carousel
  const publishRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: carouselContainerId,
      access_token: accessToken,
    }).toString(),
  });

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(
      `Instagram Graph API error ${publishRes.status} publishing carousel: ${err}`
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

// ─── TikTok Content Posting API ───────────────────────────────────────────

/**
 * Initiates a TikTok video post via the Content Posting API v2.
 *
 * TikTok's API does not support posting a text script directly — video or
 * photo media is always required. This publisher initialises a DIRECT_POST
 * video upload with the tiktok_script content as the caption/title, then
 * returns the post_id so the creator can complete the video upload via the
 * TikTok mobile app or desktop uploader.
 *
 * In practice the creator uses the generated script to record the video
 * themselves; this call establishes the post draft and returns the upload URL.
 *
 * Requires: platform_user_id (TikTok open_id), valid access token with
 *           video.publish + video.upload scopes.
 */
export async function publishToTikTok(
  platform: PlatformRow,
  content: string
): Promise<PublishResult> {
  const accessToken = decryptToken(platform.access_token_enc);

  // Truncate caption to TikTok's 2200-character limit
  const caption = content.slice(0, 2200);

  // Initialise a direct post – creator uploads the video file separately.
  // We use UPLOAD_FROM_FILE so TikTok returns an upload_url the creator can
  // use; the post_id is persisted as the external_id.
  const body = {
    post_info: {
      title: caption,
      privacy_level: "SELF_ONLY", // Draft mode; creator reviews before publishing
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      // Placeholder: in a full implementation the caller would supply a
      // pre-signed video URL. We signal to the creator that the script is
      // ready but manual video upload is required.
      video_url: "",
    },
  };

  const res = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `TikTok Content Posting API error ${res.status} initialising post: ${err}`
    );
  }

  const data = (await res.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };

  if (data.error?.code && data.error.code !== "ok") {
    throw new Error(
      `TikTok Content Posting API error: ${data.error.message ?? data.error.code}`
    );
  }

  const publishId = data.data?.publish_id ?? "unknown";

  return {
    external_id: publishId,
    // Deep-link to the creator's TikTok profile so they can complete the upload
    url: platform.metadata?.profile_deep_link as string | undefined,
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
 *
 * `carouselItems` is only used when `platform_name` is "instagram_carousel".
 */
export async function publishDerivative(
  platformName: string,
  platformRow: PlatformRow,
  content: string,
  carouselItems?: CarouselItem[]
): Promise<PublishResult> {
  switch (platformName) {
    case "twitter":
      return publishToTwitter(platformRow, content);
    case "instagram":
      return publishToInstagram(platformRow, content);
    case "instagram_carousel":
      if (!carouselItems || carouselItems.length < 2) {
        throw new Error(
          "instagram_carousel publish requires at least 2 carousel_items on the derivative"
        );
      }
      return publishInstagramCarousel(platformRow, content, carouselItems);
    case "linkedin":
      return publishToLinkedIn(platformRow, content);
    case "tiktok":
      return publishToTikTok(platformRow, content);
    case "other": // newsletter_blurb maps to "other" → Beehiiv
      return publishToBeehiiv(platformRow, content);
    default:
      throw new Error(
        `No publisher configured for platform: ${platformName}`
      );
  }
}
