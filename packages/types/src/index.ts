/**
 * @meridian/types — Shared TypeScript types
 *
 * Core domain types used across the Meridian monorepo (web, mobile, API).
 */

// ─── Enums / Union types ─────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "creator" | "pro";

export interface TierLimits {
  /** Maximum number of connected platforms. */
  platforms: number;
  /** Maximum repurpose jobs per calendar month. */
  repurposeJobsPerMonth: number;
  /** Maximum roster (team member) seats. */
  rosterSize: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { platforms: 1, repurposeJobsPerMonth: 5, rosterSize: 1 },
  creator: { platforms: 3, repurposeJobsPerMonth: 20, rosterSize: 3 },
  pro: { platforms: Infinity, repurposeJobsPerMonth: Infinity, rosterSize: Infinity },
};

export type Platform =
  | "youtube"
  | "instagram"
  | "substack"
  | "beehiiv"
  | "tiktok"
  | "twitter"
  | "linkedin"
  | "patreon";

export type ContentType = "video" | "short" | "newsletter" | "podcast";

/** Maps each content type to the platform identifier(s) that produce it. */
export const CONTENT_TYPE_PLATFORMS: Record<ContentType, Platform[]> = {
  video: ["youtube"],
  short: ["instagram", "tiktok"],
  newsletter: ["beehiiv", "substack"],
  podcast: ["youtube"],
};

export type ConnectionStatus = "active" | "reauth_required" | "disconnected";

export type RepurposeJobStatus =
  | "pending"
  | "processing"
  | "review"
  | "approved"
  | "published"
  | "failed";

// ─── Database row types ───────────────────────────────────────────────────────

export interface Creator {
  id: string;
  auth_user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectedPlatform {
  id: string;
  creator_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_username: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  creator_id: string;
  platform: Platform;
  external_id: string;
  title: string;
  body: string | null;
  thumbnail_url: string | null;
  published_at: string;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceSnapshot {
  id: string;
  content_item_id: string;
  creator_id: string;
  day_mark: string;
  snapshot_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watch_time_minutes: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  open_rate: number | null;
  click_rate: number | null;
  engagement_rate: number | null;
  created_at: string;
}

export type PatternConfidenceLabel = "Strong" | "Moderate" | "Emerging";

export interface PatternInsight {
  id: string;
  creator_id: string;
  pattern_type: string;
  title: string;
  description: string;
  confidence_score: number;
  supporting_content_ids: string[];
  /** Claude-generated 2–3 sentence plain-English insight. Null if narration failed. */
  narrative: string | null;
  /** Human-readable confidence tier derived from sample count. Null if narration failed. */
  confidence_label: PatternConfidenceLabel | null;
  created_at: string;
  updated_at: string;
}

/**
 * Platform-agnostic metrics produced by the normalisation layer.
 *
 * All platform-native metric schemas are mapped to this consistent shape so
 * that cross-platform comparisons are apples-to-apples.
 *
 * Fields
 * ──────
 *  views              — Total view / open count (integer ≥ 0).
 *  engagement_rate    — Ratio of interactions to views, clamped to [0, 1].
 *                       Calculated per-platform (see normalizeMetrics docs).
 *  watch_time_seconds — Cumulative watch time in seconds. `null` for platforms
 *                       that do not expose this data (Instagram, Beehiiv).
 */
export interface NormalizedMetrics {
  views: number;
  engagement_rate: number;
  watch_time_seconds: number | null;
}

export type DerivativeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "failed_publish";

export type DerivativeFormatKey =
  | "twitter_thread"
  | "linkedin_post"
  | "instagram_caption"
  | "instagram_carousel"
  | "newsletter_blurb"
  | "tiktok_script"
  | "podcast_show_notes"
  | "patreon_post";

/**
 * A single media item in an Instagram carousel post.
 * Carousels support 2–10 items (images and/or videos).
 */
export interface CarouselItem {
  /** Publicly accessible URL for the image or video file. */
  url: string;
  /** Media type. Defaults to IMAGE when omitted. */
  media_type?: "IMAGE" | "VIDEO";
}

export interface Derivative {
  format: DerivativeFormatKey;
  content: string;
  platform: string;
  char_count: number;
  status: DerivativeStatus;
  previous_drafts: string[];
  /**
   * Media items for an instagram_carousel derivative.
   * Must contain 2–10 items. Not used for other formats.
   */
  carousel_items?: CarouselItem[];
  /** ISO 8601 datetime when this derivative is scheduled to publish. Null if not scheduled. */
  scheduled_at: string | null;
  /** Unique ID used to cancel this schedule via Inngest cancelOn. Null if not scheduled. */
  schedule_id: string | null;
  /** ISO 8601 datetime when this derivative was actually published. Null until published. */
  published_at: string | null;
  /** Error message if publishing failed. Null otherwise. */
  publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepurposeJob {
  id: string;
  creator_id: string;
  source_content_id: string;
  target_platform: Platform;
  target_format: string;
  status: RepurposeJobStatus;
  output: string | null;
  derivatives: Derivative[];
  selected_formats: DerivativeFormatKey[];
  source_transcript: string | null;
  created_at: string;
  updated_at: string;
}
