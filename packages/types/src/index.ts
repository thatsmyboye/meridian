/**
 * @meridian/types — Shared TypeScript types
 *
 * Core domain types used across the Meridian monorepo (web, mobile, API).
 */

// ─── Enums / Union types ─────────────────────────────────────────────────────

export type Platform = "youtube" | "instagram" | "tiktok" | "beehiiv";

export type ContentType = "video" | "short" | "newsletter" | "podcast";

/** Maps each content type to the platform identifier(s) that produce it. */
export const CONTENT_TYPE_PLATFORMS: Record<ContentType, Platform[]> = {
  video: ["youtube"],
  short: ["instagram", "tiktok"],
  newsletter: ["beehiiv"],
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
  platform_content_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string;
  duration_seconds: number | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceSnapshot {
  id: string;
  content_item_id: string;
  creator_id: string;
  day_mark: string;
  snapshot_date: string;
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

export type DerivativeStatus = "pending" | "approved" | "rejected";

export type DerivativeFormatKey =
  | "twitter_thread"
  | "linkedin_post"
  | "instagram_caption"
  | "newsletter_blurb"
  | "tiktok_script";

export interface Derivative {
  format: DerivativeFormatKey;
  content: string;
  platform: string;
  char_count: number;
  status: DerivativeStatus;
  previous_drafts: string[];
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
