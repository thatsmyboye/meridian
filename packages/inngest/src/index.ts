/**
 * @meridian/inngest — Shared Inngest configuration
 *
 * Exports the Inngest client, typed event schemas, and all background
 * function handlers used by the Meridian platform.
 */

export { INNGEST_APP_ID, inngest } from "./client";
export type { MeridianEvents } from "./events";

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
