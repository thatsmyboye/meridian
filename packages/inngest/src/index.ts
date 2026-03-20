/**
 * @meridian/inngest — Shared Inngest configuration
 *
 * Exports the Inngest client, typed event schemas, and all background
 * function handlers used by the Meridian platform.
 */

export { INNGEST_APP_ID, inngest } from "./client";
export type { MeridianEvents } from "./events";

// ─── Metrics normalisation layer ─────────────────────────────────────────────
export { normalizeMetrics } from "./lib/normalizeMetrics";
export type {
  PlatformRawMetrics,
  YouTubeRawMetrics,
  InstagramRawMetrics,
  BeehiivRawMetrics,
} from "./lib/normalizeMetrics";

// ─── Background function handlers ────────────────────────────────────────────
export { syncYoutubeMetadata } from "./functions/youtube-sync";
export { handlePlatformConnected } from "./functions/platform-connected";
export {
  youtubeAnalyticsCron,
  fetchYoutubeAnalyticsSnapshot,
} from "./functions/youtube-analytics-cron";
export { syncInstagramMedia } from "./functions/instagram-sync";
export {
  instagramAnalyticsCron,
  fetchInstagramAnalyticsSnapshot,
} from "./functions/instagram-analytics-cron";
export { syncBeehiivPosts } from "./functions/beehiiv-sync";
export {
  beehiivAnalyticsCron,
  fetchBeehiivAnalyticsSnapshot,
} from "./functions/beehiiv-analytics-cron";
export {
  weeklyStatsCron,
  computeCreatorPatterns,
} from "./functions/weekly-stats-cron";
export {
  weeklyDigestCron,
  sendWeeklyDigest,
} from "./functions/weekly-digest-cron";
export { extractRepurposeTranscript } from "./functions/repurpose-transcript-extraction";
export {
  generateDerivatives,
  regenerateDerivative,
} from "./functions/generate-derivatives";
export { DERIVATIVE_FORMATS, FORMAT_KEYS } from "./lib/derivative-prompts";
export type { DerivativeFormat } from "./lib/derivative-prompts";
export {
  publishScheduledDerivative,
  handlePublishFailure,
} from "./functions/publish-scheduled-derivative";
export { linkedinTokenExpiryCron } from "./functions/linkedin-token-expiry-cron";
export { expireTrialsCron } from "./functions/expire-trials-cron";
export { backfillSnapshots } from "./functions/backfill-snapshots";
