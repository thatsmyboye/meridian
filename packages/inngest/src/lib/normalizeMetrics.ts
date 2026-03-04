/**
 * Metrics Normalisation Layer
 *
 * Each platform reports analytics in its own schema with different field names,
 * units, and engagement definitions. This module maps every platform's raw API
 * response into a single `NormalizedMetrics` shape so that cross-platform
 * comparisons are apples-to-apples.
 *
 * Canonical output schema
 * ─────────────────────────────────────────────────────────────────────────────
 *  views              integer       Total view / open count (≥ 0).
 *  engagement_rate    float [0, 1]  Ratio of interactions to views.
 *  watch_time_seconds number | null Cumulative watch time in seconds;
 *                                   null for platforms without this data.
 *
 * Platform mapping summary
 * ─────────────────────────────────────────────────────────────────────────────
 *  Platform    views                engagement_rate                      watch_time_seconds
 *  ─────────── ──────────────────── ──────────────────────────────────── ──────────────────
 *  YouTube     views                (likes+comments+shares) / views      estimatedMinutesWatched × 60
 *  Instagram   views (unified)*     (likes+comments+shares+saves)/views  null
 *  Beehiiv     unique_opened        open_rate / 100                      null
 *
 *  * Meta replaced the deprecated `impressions` (images) and `plays`
 *    (videos/Reels) with a single `views` metric on April 21, 2025.
 */

import type { NormalizedMetrics } from "@meridian/types";

// ─── Raw platform metric shapes ───────────────────────────────────────────────

/**
 * Raw metrics as returned by the YouTube Analytics API /reports endpoint.
 *
 * Columns requested: views, estimatedMinutesWatched, likes, comments, shares
 * Each value is drawn from the first row of the API response:
 *   row = [videoId, views, estimatedMinutesWatched, likes, comments, shares]
 */
export interface YouTubeRawMetrics {
  platform: "youtube";
  /** Total view count for the cumulative date range. Maps to normalized `views`. */
  views: number;
  /**
   * Cumulative watch time in minutes (YouTube's native unit).
   * Multiplied by 60 to produce normalized `watch_time_seconds`.
   */
  estimatedMinutesWatched: number;
  /** Interaction signal for engagement_rate numerator. */
  likes: number;
  /** Interaction signal for engagement_rate numerator. */
  comments: number;
  /** Interaction signal for engagement_rate numerator. */
  shares: number;
}

/**
 * Raw metrics as returned by the Instagram Graph API.
 *
 * `views` is Meta's unified metric (introduced April 21, 2025):
 *   — images / carousels: counts impressions (unique accounts that saw the post)
 *   — videos / Reels: counts plays
 * It replaces the now-deprecated `impressions` and `plays` fields.
 *
 * `likes` and `comments` are fetched directly from the media object
 * (like_count / comments_count), not from the Insights endpoint.
 *
 * `saves` are included in the engagement numerator because on Instagram they
 * represent strong intent (a user bookmarking content for later), which is a
 * meaningful engagement signal absent from other platforms.
 */
export interface InstagramRawMetrics {
  platform: "instagram";
  /**
   * Meta's unified reach/play metric (Apr 2025 migration).
   * Maps directly to normalized `views`.
   */
  views: number;
  /** Interaction signal for engagement_rate numerator. */
  likes: number;
  /** Interaction signal for engagement_rate numerator. */
  comments: number;
  /** Interaction signal for engagement_rate numerator. */
  shares: number;
  /**
   * Saves / bookmarks. Counted in the engagement_rate numerator alongside
   * likes, comments, and shares — saves signal strong user intent on Instagram.
   */
  saves: number;
}

/**
 * Raw metrics as returned by the Beehiiv API v2
 * GET /publications/{id}/posts/{id}?expand[]=stats
 *
 * Beehiiv is an email newsletter platform. Watch time and video-centric
 * engagement concepts do not apply. The email `open_rate` is the closest
 * analogue to "a reader engaged with this content", so it serves as the
 * engagement_rate proxy.
 *
 * open_rate is returned as a percentage (e.g. 42.5 means 42.5 %).
 */
export interface BeehiivRawMetrics {
  platform: "beehiiv";
  /**
   * Number of unique subscribers who opened the email.
   * Maps to normalized `views` — the most direct analogue to "unique content
   * views" in an email context.
   */
  uniqueOpened: number;
  /**
   * Total recipients at send time (list size). Retained for context but not
   * used in the current engagement formula; open_rate already encodes
   * uniqueOpened / recipients as a pre-computed percentage.
   */
  recipients: number;
  /**
   * Pre-computed open rate as a percentage (0–100).
   * Divided by 100 to produce normalized `engagement_rate` (fraction 0–1).
   */
  openRate: number;
}

// ─── Discriminated union of all supported platforms ───────────────────────────

export type PlatformRawMetrics =
  | YouTubeRawMetrics
  | InstagramRawMetrics
  | BeehiivRawMetrics;

// ─── Public normaliser ────────────────────────────────────────────────────────

/**
 * Converts platform-native raw metrics into the canonical `NormalizedMetrics`
 * schema so that cross-platform comparisons are apples-to-apples.
 *
 * `engagement_rate` is always clamped to [0, 1] as a defensive measure against
 * API anomalies (e.g. bot-inflated interactions exceeding the view count).
 *
 * `views` is always rounded to the nearest integer because some platform APIs
 * return floating-point counts after internal normalisation on their side.
 *
 * @example
 *   const normalized = normalizeMetrics({
 *     platform: "youtube",
 *     views: 10_000,
 *     estimatedMinutesWatched: 25_000,
 *     likes: 800,
 *     comments: 120,
 *     shares: 80,
 *   });
 *   // { views: 10000, engagement_rate: 0.1, watch_time_seconds: 1500000 }
 */
export function normalizeMetrics(raw: PlatformRawMetrics): NormalizedMetrics {
  switch (raw.platform) {
    case "youtube":
      return normalizeYouTube(raw);
    case "instagram":
      return normalizeInstagram(raw);
    case "beehiiv":
      return normalizeBeehiiv(raw);
  }
}

// ─── Per-platform implementations ─────────────────────────────────────────────

/**
 * YouTube → NormalizedMetrics
 *
 *  views              ← views (direct, rounded)
 *  engagement_rate    ← (likes + comments + shares) / views, clamped [0, 1]
 *                       0 when views === 0 (avoids division by zero)
 *  watch_time_seconds ← estimatedMinutesWatched × 60
 *                       (convert YouTube's native minutes unit to seconds)
 */
function normalizeYouTube(raw: YouTubeRawMetrics): NormalizedMetrics {
  const interactions = raw.likes + raw.comments + raw.shares;
  const engagement_rate =
    raw.views > 0 ? clamp(interactions / raw.views, 0, 1) : 0;

  return {
    views: Math.round(raw.views),
    engagement_rate,
    watch_time_seconds: Math.round(raw.estimatedMinutesWatched * 60),
  };
}

/**
 * Instagram → NormalizedMetrics
 *
 *  views              ← views (Meta's unified metric, Apr 2025; direct, rounded)
 *  engagement_rate    ← (likes + comments + shares + saves) / views, clamped [0, 1]
 *                       saves are included because they signal strong intent on Instagram
 *                       0 when views === 0 (avoids division by zero)
 *  watch_time_seconds ← null (Instagram does not expose watch time via the API)
 */
function normalizeInstagram(raw: InstagramRawMetrics): NormalizedMetrics {
  const interactions = raw.likes + raw.comments + raw.shares + raw.saves;
  const engagement_rate =
    raw.views > 0 ? clamp(interactions / raw.views, 0, 1) : 0;

  return {
    views: Math.round(raw.views),
    engagement_rate,
    watch_time_seconds: null,
  };
}

/**
 * Beehiiv → NormalizedMetrics
 *
 *  views              ← uniqueOpened (unique email opens ≈ "unique content views")
 *  engagement_rate    ← openRate / 100
 *                       Beehiiv's openRate is a percentage (e.g. 42.5 → 0.425)
 *  watch_time_seconds ← null (email newsletters have no watch-time concept)
 */
function normalizeBeehiiv(raw: BeehiivRawMetrics): NormalizedMetrics {
  return {
    views: Math.round(raw.uniqueOpened),
    engagement_rate: clamp(raw.openRate / 100, 0, 1),
    watch_time_seconds: null,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
