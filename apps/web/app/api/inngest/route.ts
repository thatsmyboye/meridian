import { serve } from "inngest/next";
import {
  inngest,
  syncYoutubeMetadata,
  handlePlatformConnected,
  youtubeAnalyticsCron,
  fetchYoutubeAnalyticsSnapshot,
  syncInstagramMedia,
  instagramAnalyticsCron,
  fetchInstagramAnalyticsSnapshot,
  syncBeehiivPosts,
  beehiivAnalyticsCron,
  fetchBeehiivAnalyticsSnapshot,
  weeklyStatsCron,
  computeCreatorPatterns,
} from "@meridian/inngest";

/**
 * Inngest serve endpoint for the Meridian web app.
 *
 * Registers all background function handlers so that Inngest can invoke them
 * via this route. The SDK handles GET (introspection), POST (function execution),
 * and PUT (registration sync) automatically.
 *
 * Required env vars (production):
 *   INNGEST_SIGNING_KEY  – verifies requests are from Inngest servers
 *   INNGEST_EVENT_KEY    – used when sending events from the app
 *
 * In development with `inngest dev`, no signing key is needed.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncYoutubeMetadata,
    handlePlatformConnected,
    youtubeAnalyticsCron,
    fetchYoutubeAnalyticsSnapshot,
    syncInstagramMedia,
    instagramAnalyticsCron,
    fetchInstagramAnalyticsSnapshot,
    syncBeehiivPosts,
    beehiivAnalyticsCron,
    fetchBeehiivAnalyticsSnapshot,
    weeklyStatsCron,
    computeCreatorPatterns,
  ],
});
