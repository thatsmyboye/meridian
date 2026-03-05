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
      /**
       * Lifecycle day mark for this snapshot (1, 7, or 30 days after
       * publication). Omit for ad-hoc snapshots.
       */
      day_mark?: 1 | 7 | 30 | null;
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

  /**
   * Fired when transcript extraction for a repurpose job is complete.
   * `transcript_length` is 0 when no transcript could be obtained.
   */
  "repurpose/transcript.extracted": {
    data: {
      creator_id: string;
      repurpose_job_id: string;
      transcript_length: number;
    };
  };

  /** Triggers regeneration of a single derivative format for a job. */
  "repurpose/derivative.regenerate": {
    data: {
      creator_id: string;
      repurpose_job_id: string;
      format_key: string;
    };
  };

  /** Triggers sending the weekly digest email for a single creator. */
  "digest/weekly.send": {
    data: {
      creator_id: string;
    };
  };
};
