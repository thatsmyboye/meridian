import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
 
/**
 * One-time backfill: fans out `analytics/snapshot.requested` events for every
 * content item that has no snapshot at all, across all supported platforms.
 *
 * Invoke manually from the Inngest dashboard with an empty payload `{}`.
 * Safe to re-run — items that already have at least one snapshot are skipped.
 *
 * Steps:
 *  1. find-unsnapshotted-items  – All content_item IDs (youtube/instagram/beehiiv)
 *                                 that have zero rows in performance_snapshots.
 *  2. dispatch-snapshot-events  – Fan-out one `analytics/snapshot.requested`
 *                                 event per item (no day_mark → ad-hoc snapshot).
 */
export const backfillSnapshots = inngest.createFunction(
  {
    id: "backfill-snapshots",
    name: "Backfill Missing Analytics Snapshots",
    retries: 1,
  },
  { event: "analytics/backfill.requested" },
  async ({ step }) => {
    const items = await step.run("find-unsnapshotted-items", async () => {
      const supabase = getSupabaseAdmin();
 
      // All content items for connected, active platforms.
      const { data: contentItems, error: itemsError } = await supabase
        .from("content_items")
        .select("id, creator_id, platform")
        .in("platform", ["youtube", "instagram", "beehiiv"]);
 
      if (itemsError) {
        throw new Error(`Failed to fetch content items: ${itemsError.message}`);
      }
      if (!contentItems?.length) return [];
 
      // IDs that already have at least one snapshot.
      const { data: existing, error: existingError } = await supabase
        .from("performance_snapshots")
        .select("content_item_id");
 
      if (existingError) {
        throw new Error(
          `Failed to fetch existing snapshots: ${existingError.message}`
        );
      }
 
      const alreadySnapshotted = new Set(
        (existing ?? []).map((r) => r.content_item_id as string)
      );
 
      return contentItems
        .filter((c) => !alreadySnapshotted.has(c.id as string))
        .map((c) => ({
          id: c.id as string,
          creator_id: c.creator_id as string,
          platform: c.platform as "youtube" | "instagram" | "beehiiv",
        }));
    });
 
    if (items.length === 0) {
      return { message: "All content items already have snapshots.", dispatched: 0 };
    }
 
    await step.sendEvent(
      "dispatch-snapshot-events",
      items.map((item) => ({
        name: "analytics/snapshot.requested" as const,
        data: {
          creator_id: item.creator_id,
          content_item_id: item.id,
          platform: item.platform,
          // No day_mark — this is an ad-hoc current snapshot.
        },
      }))
    );
 
    return {
      dispatched: items.length,
      byPlatform: {
        youtube: items.filter((i) => i.platform === "youtube").length,
        instagram: items.filter((i) => i.platform === "instagram").length,
        beehiiv: items.filter((i) => i.platform === "beehiiv").length,
      },
    };
  }
);
