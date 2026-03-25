import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

/**
 * Handles the platform/connected event.
 *
 * For platforms with a content sync function, immediately enqueues a full
 * content sync so that content_items are populated as soon as the creator
 * connects. For platforms without a sync function (twitter, tiktok), stamps
 * last_synced_at directly so the /connect page spinner resolves immediately.
 */
export const handlePlatformConnected = inngest.createFunction(
  {
    id: "handle-platform-connected",
    name: "Handle Platform Connected",
    retries: 2,
  },
  { event: "platform/connected" },
  async ({ event, step }) => {
    const { creator_id, platform, connected_platform_id } = event.data;

    if (platform === "youtube") {
      await step.sendEvent("request-youtube-sync", {
        name: "content/sync.requested",
        data: { creator_id, connected_platform_id, platform },
      });
    }

    if (platform === "instagram") {
      await step.sendEvent("request-instagram-sync", {
        name: "content/sync.requested",
        data: { creator_id, connected_platform_id, platform },
      });
    }

    if (platform === "beehiiv") {
      await step.sendEvent("request-beehiiv-sync", {
        name: "content/sync.requested",
        data: { creator_id, connected_platform_id, platform },
      });
    }

    if (platform === "substack") {
      await step.sendEvent("request-substack-sync", {
        name: "content/sync.requested",
        data: { creator_id, connected_platform_id, platform },
      });
    }

    if (platform === "linkedin") {
      await step.sendEvent("request-linkedin-sync", {
        name: "content/sync.requested",
        data: { creator_id, connected_platform_id, platform },
      });
    }

    // Platforms without a dedicated content sync function (twitter, tiktok)
    // never have last_synced_at set, causing the /connect page spinner to spin
    // forever. Stamp it here so the UI resolves correctly.
    if (platform === "twitter" || platform === "tiktok") {
      await step.run("mark-synced", async () => {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from("connected_platforms")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", connected_platform_id);
        if (error) throw new Error(`mark-synced failed: ${error.message}`);
      });
    }

    return { creator_id, platform };
  }
);
