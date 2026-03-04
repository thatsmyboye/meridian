import { inngest } from "../client";

/**
 * Handles the platform/connected event.
 *
 * For YouTube connections, immediately enqueues a full content sync so that
 * content_items are populated as soon as the creator connects their channel.
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

    return { creator_id, platform };
  }
);
