import type { Platform } from "@meridian/types";

/**
 * Typed Inngest event catalogue for Meridian.
 *
 * Pass this type to `new Inngest<MeridianEvents>({ id: INNGEST_APP_ID })`
 * in E02 to get end-to-end type safety on all event payloads.
 */
export type MeridianEvents = {
  /** Fired when a creator successfully connects a platform account. */
  "platform/connected": {
    data: {
      creator_id: string;
      platform: Platform;
      connected_platform_id: string;
    };
  };

  /** Triggers a full content metadata sync for a connected platform. */
  "content/sync.requested": {
    data: {
      creator_id: string;
      connected_platform_id: string;
      platform: Platform;
    };
  };

  /** Triggers a performance snapshot for a single content item. */
  "analytics/snapshot.requested": {
    data: {
      creator_id: string;
      content_item_id: string;
      platform: Platform;
    };
  };

  /** Triggers the pattern intelligence engine for a creator. */
  "patterns/analysis.requested": {
    data: {
      creator_id: string;
    };
  };

  /** Triggers repurposing pipeline for a content item. */
  "repurpose/job.created": {
    data: {
      creator_id: string;
      repurpose_job_id: string;
    };
  };
};
