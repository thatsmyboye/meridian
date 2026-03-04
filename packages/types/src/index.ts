/**
 * @meridian/types — Shared TypeScript types
 *
 * Core domain types used across the Meridian monorepo (web, mobile, API).
 */

// ─── Enums / Union types ─────────────────────────────────────────────────────

export type Platform = "youtube" | "instagram" | "tiktok" | "beehiiv";

export type ContentType = "video" | "short" | "newsletter" | "podcast";

/** Maps each content type to the platform identifier(s) that produce it. */
export const CONTENT_TYPE_PLATFORMS: Record<ContentType, string[]> = {
  video: ["youtube"],
  short: ["instagram", "tiktok"],
  newsletter: ["beehiiv"],
  podcast: ["podcast"],
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
  access_token: string;
  refresh_token: string | null;
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
  snapshot_date: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  watch_time_minutes: number | null;
  reach: number | null;
  impressions: number | null;
  engagement_rate: number | null;
  created_at: string;
}

export interface PatternInsight {
  id: string;
  creator_id: string;
  pattern_type: string;
  title: string;
  description: string;
  confidence_score: number;
  supporting_content_ids: string[];
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
  created_at: string;
  updated_at: string;
}
