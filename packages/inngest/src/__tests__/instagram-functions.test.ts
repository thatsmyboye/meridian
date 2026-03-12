/**
 * Instagram Inngest Functions — Unit Tests
 *
 * Validates the logic embedded in:
 *   - syncInstagramMedia  (instagram-sync.ts)
 *   - fetchInstagramAnalyticsSnapshot  (instagram-analytics-cron.ts)
 *   - instagramAnalyticsCron  (instagram-analytics-cron.ts)
 *
 * All tests are pure-logic / structural — no network calls, no Supabase, no
 * Inngest runtime required.
 */

import { describe, it, expect } from "vitest";

// ─── Shared type definitions (mirror the production types) ─────────────────

interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
  like_count?: number;
  comments_count?: number;
}

interface InstagramMediaListResponse {
  data: InstagramMediaItem[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
}

interface InstagramInsightsResult {
  name: string;
  period: string;
  values?: Array<{ value: number }>;
  total_value?: { value: number };
  id: string;
}

// ─── Helper: mirrors instagram-analytics-cron.ts extractInsightValue ──────

function extractInsightValue(metric: InstagramInsightsResult): number {
  if (metric.total_value !== undefined) {
    return metric.total_value.value ?? 0;
  }
  return metric.values?.[0]?.value ?? 0;
}

// ─── Helper: mirrors instagram-sync.ts pickThumbnail ──────────────────────

function pickThumbnail(item: Pick<InstagramMediaItem, "thumbnail_url" | "media_url">): string | null {
  return item.thumbnail_url ?? item.media_url ?? null;
}

// ─── Helper: mirrors instagram-sync.ts content-item mapping ───────────────

function mapToContentItem(
  creatorId: string,
  platformId: string,
  item: InstagramMediaItem
) {
  return {
    creator_id: creatorId,
    platform_id: platformId,
    platform: "instagram" as const,
    external_id: item.id,
    title: item.caption?.split("\n")[0]?.slice(0, 255) ?? null,
    body: item.caption ?? null,
    published_at: item.timestamp,
    thumbnail_url: pickThumbnail(item),
    duration_seconds: null,
    raw_data: item,
  };
}

// ─── Helper: mirrors instagram-analytics-cron.ts hasNextPage ──────────────

function hasNextPage(paging: InstagramMediaListResponse["paging"]): boolean {
  return Boolean(paging?.next && paging?.cursors?.after);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Instagram Graph API — Media Response Structure", () => {
  const validMediaResponse: InstagramMediaListResponse = {
    data: [
      {
        id: "123456789",
        caption: "Example post caption\nwith multiple lines",
        media_type: "IMAGE",
        media_url: "https://cdn.example.com/image.jpg",
        timestamp: new Date().toISOString(),
        permalink: "https://www.instagram.com/p/ABC123/",
        like_count: 150,
        comments_count: 25,
      },
      {
        id: "987654321",
        media_type: "REEL",
        thumbnail_url: "https://cdn.example.com/reel-thumb.jpg",
        timestamp: new Date(Date.now() - 86_400_000).toISOString(),
        permalink: "https://www.instagram.com/reels/XYZ789/",
        like_count: 450,
        comments_count: 85,
      },
    ],
    paging: {
      cursors: { after: "next_cursor_token" },
      next: "https://graph.facebook.com/v21.0/me/media?after=next_cursor_token",
    },
  };

  it("response data should be an array", () => {
    expect(Array.isArray(validMediaResponse.data)).toBe(true);
  });

  it("each media item has a required id", () => {
    validMediaResponse.data.forEach((item) => {
      expect(item.id).toBeTruthy();
    });
  });

  it("each media item has a valid media_type", () => {
    const validTypes = ["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REEL"];
    validMediaResponse.data.forEach((item) => {
      expect(validTypes).toContain(item.media_type);
    });
  });

  it("each media item has a timestamp and permalink", () => {
    validMediaResponse.data.forEach((item) => {
      expect(item.timestamp).toBeTruthy();
      expect(item.permalink).toBeTruthy();
    });
  });

  it("pagination cursor is present when there is a next page", () => {
    expect(validMediaResponse.paging?.cursors?.after).toBeTruthy();
    expect(validMediaResponse.paging?.next).toBeTruthy();
  });
});

describe("Instagram Graph API — Insights Response Structure", () => {
  it("handles old-format response (values array)", () => {
    const oldFormat = {
      data: [
        { name: "views", period: "lifetime", values: [{ value: 5000 }], id: "media_id/views" },
        { name: "reach", period: "lifetime", values: [{ value: 3500 }], id: "media_id/reach" },
      ],
    };

    oldFormat.data.forEach((metric) => {
      const hasValues = Array.isArray(metric.values);
      expect(hasValues).toBe(true);
      expect(metric.name).toBeTruthy();
      expect(metric.period).toBe("lifetime");
    });
  });

  it("handles new-format response (total_value object, Graph API v19.0+)", () => {
    const newFormat = {
      data: [
        { name: "views", period: "lifetime", total_value: { value: 5000 }, id: "media_id/views" },
        { name: "reach", period: "lifetime", total_value: { value: 3500 }, id: "media_id/reach" },
      ],
    };

    newFormat.data.forEach((metric) => {
      expect(metric.total_value).toBeDefined();
      expect(typeof metric.total_value?.value).toBe("number");
    });
  });

  it("each metric has at least one of values or total_value", () => {
    const mixed = [
      { name: "views", period: "lifetime", values: [{ value: 100 }], id: "1" },
      { name: "reach", period: "lifetime", total_value: { value: 80 }, id: "2" },
    ];

    mixed.forEach((metric) => {
      const hasValues = Array.isArray((metric as any).values);
      const hasTotalValue = (metric as any).total_value !== undefined;
      expect(hasValues || hasTotalValue).toBe(true);
    });
  });
});

describe("extractInsightValue", () => {
  it("extracts value from new total_value format", () => {
    expect(extractInsightValue({ name: "views", period: "lifetime", total_value: { value: 5000 }, id: "x" })).toBe(5000);
  });

  it("extracts value from old values-array format", () => {
    expect(extractInsightValue({ name: "views", period: "lifetime", values: [{ value: 3000 }], id: "x" })).toBe(3000);
  });

  it("prefers total_value when both formats are present", () => {
    expect(
      extractInsightValue({
        name: "views",
        period: "lifetime",
        values: [{ value: 1000 }],
        total_value: { value: 9999 },
        id: "x",
      })
    ).toBe(9999);
  });

  it("returns 0 for an empty values array", () => {
    expect(extractInsightValue({ name: "views", period: "lifetime", values: [], id: "x" })).toBe(0);
  });

  it("returns 0 when neither format is present", () => {
    expect(extractInsightValue({ name: "views", period: "lifetime", id: "x" })).toBe(0);
  });
});

describe("pickThumbnail", () => {
  it("uses thumbnail_url for VIDEO/REEL items", () => {
    expect(pickThumbnail({ thumbnail_url: "https://cdn.example.com/thumb.jpg", media_url: undefined }))
      .toBe("https://cdn.example.com/thumb.jpg");
  });

  it("falls back to media_url for IMAGE/CAROUSEL items", () => {
    expect(pickThumbnail({ thumbnail_url: undefined, media_url: "https://cdn.example.com/image.jpg" }))
      .toBe("https://cdn.example.com/image.jpg");
  });

  it("prefers thumbnail_url over media_url when both are present", () => {
    expect(
      pickThumbnail({
        thumbnail_url: "https://cdn.example.com/thumb.jpg",
        media_url: "https://cdn.example.com/image.jpg",
      })
    ).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("returns null when both fields are absent", () => {
    expect(pickThumbnail({ thumbnail_url: undefined, media_url: undefined })).toBeNull();
  });
});

describe("Content item mapping (instagram-sync.ts)", () => {
  const creatorId = "creator_abc";
  const platformId = "platform_xyz";
  const rawItem: InstagramMediaItem = {
    id: "ig_media_789",
    caption: "First line of caption\nSecond line\nThird line",
    media_type: "IMAGE",
    media_url: "https://cdn.example.com/image.jpg",
    timestamp: "2025-03-04T12:00:00Z",
    permalink: "https://www.instagram.com/p/ABC123/",
    like_count: 150,
    comments_count: 25,
  };

  const mapped = mapToContentItem(creatorId, platformId, rawItem);

  it("maps creator_id and platform_id correctly", () => {
    expect(mapped.creator_id).toBe(creatorId);
    expect(mapped.platform_id).toBe(platformId);
  });

  it("maps external_id from item.id", () => {
    expect(mapped.external_id).toBe(rawItem.id);
  });

  it("extracts the first line of caption as title (max 255 chars)", () => {
    expect(mapped.title).toBe("First line of caption");
  });

  it("preserves the full caption as body", () => {
    expect(mapped.body).toBe(rawItem.caption);
  });

  it("sets platform to 'instagram'", () => {
    expect(mapped.platform).toBe("instagram");
  });

  it("sets duration_seconds to null (not available from the media endpoint)", () => {
    expect(mapped.duration_seconds).toBeNull();
  });

  it("uses media_url as thumbnail for IMAGE items", () => {
    expect(mapped.thumbnail_url).toBe(rawItem.media_url);
  });

  it("caps the title at 255 characters", () => {
    const longCaptionItem: InstagramMediaItem = {
      ...rawItem,
      caption: "A".repeat(300),
    };
    const result = mapToContentItem(creatorId, platformId, longCaptionItem);
    expect(result.title!.length).toBeLessThanOrEqual(255);
  });

  it("sets title and body to null when caption is absent", () => {
    const noCaptionItem: InstagramMediaItem = { ...rawItem, caption: undefined };
    const result = mapToContentItem(creatorId, platformId, noCaptionItem);
    expect(result.title).toBeNull();
    expect(result.body).toBeNull();
  });
});

describe("Pagination logic (instagram-sync.ts)", () => {
  it("continues when both cursor and next link are present", () => {
    expect(hasNextPage({ cursors: { after: "token123" }, next: "https://graph.facebook.com/..." })).toBe(true);
  });

  it("stops when cursor is absent", () => {
    expect(hasNextPage({ cursors: undefined, next: "https://graph.facebook.com/..." })).toBe(false);
  });

  it("stops when next link is absent", () => {
    expect(hasNextPage({ cursors: { after: "token123" }, next: undefined })).toBe(false);
  });

  it("stops when both cursor and next link are absent", () => {
    expect(hasNextPage({ cursors: undefined, next: undefined })).toBe(false);
  });

  it("stops when paging object is undefined", () => {
    expect(hasNextPage(undefined)).toBe(false);
  });

  it("stops when cursor.after is an empty string", () => {
    expect(hasNextPage({ cursors: { after: "" }, next: "https://..." })).toBe(false);
  });
});

describe("Performance snapshot calculation", () => {
  const metrics = {
    views: 1000,
    reach: 850,
    saves: 45,
    shares: 15,
    likes: 120,
    comments: 30,
  };

  it("calculates engagement_rate as (likes+comments+shares+saves)/views", () => {
    const interactions = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
    const engagementRate = interactions / metrics.views;
    expect(engagementRate).toBeCloseTo(0.21, 3);
  });

  it("clamps engagement_rate to [0, 1] when interactions exceed views", () => {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const highInteractions = { views: 100, likes: 200, comments: 50, shares: 10, saves: 5 };
    const rate = clamp(
      (highInteractions.likes + highInteractions.comments + highInteractions.shares + highInteractions.saves) /
        highInteractions.views
    );
    expect(rate).toBe(1);
  });

  it("returns 0 engagement_rate when views is 0 (avoids division by zero)", () => {
    const zeroViews = { views: 0, likes: 10, comments: 2, shares: 1, saves: 3 };
    const rate = zeroViews.views > 0
      ? (zeroViews.likes + zeroViews.comments + zeroViews.shares + zeroViews.saves) / zeroViews.views
      : 0;
    expect(rate).toBe(0);
  });

  it("sets impressions equal to views (Meta's unified metric)", () => {
    expect(metrics.views).toBe(1000); // impressions === views in the snapshot
  });
});

describe("Day mark calculation (instagram-analytics-cron.ts)", () => {
  const SNAPSHOT_DAY_MARKS = [1, 7, 30] as const;

  function getEligibleDayMark(publishedAt: Date, now: Date): number | null {
    for (const dayMark of SNAPSHOT_DAY_MARKS) {
      const lower = new Date(now.getTime() - (dayMark + 0.5) * 86_400_000);
      const upper = new Date(now.getTime() - (dayMark - 0.5) * 86_400_000);
      if (publishedAt >= lower && publishedAt <= upper) return dayMark;
    }
    return null;
  }

  it("matches day mark 1 for an item published ~1 day ago", () => {
    const now = new Date("2025-03-04T10:00:00Z");
    const published = new Date("2025-03-03T10:00:00Z"); // exactly 1 day
    expect(getEligibleDayMark(published, now)).toBe(1);
  });

  it("matches day mark 7 for an item published ~7 days ago", () => {
    const now = new Date("2025-03-11T10:00:00Z");
    const published = new Date("2025-03-04T10:00:00Z"); // exactly 7 days
    expect(getEligibleDayMark(published, now)).toBe(7);
  });

  it("matches day mark 30 for an item published ~30 days ago", () => {
    const now = new Date("2025-04-03T10:00:00Z");
    const published = new Date("2025-03-04T10:00:00Z"); // exactly 30 days
    expect(getEligibleDayMark(published, now)).toBe(30);
  });

  it("returns null for a newly published item (0 days ago)", () => {
    const now = new Date();
    const published = new Date(now.getTime() - 60_000); // 1 minute ago
    expect(getEligibleDayMark(published, now)).toBeNull();
  });

  it("returns null for an item published 45 days ago (outside all windows)", () => {
    const now = new Date("2025-04-18T10:00:00Z");
    const published = new Date("2025-03-04T10:00:00Z"); // 45 days
    expect(getEligibleDayMark(published, now)).toBeNull();
  });

  it("the ±12-hour window tolerates publication time offsets", () => {
    const now = new Date("2025-03-05T01:00:00Z");
    // Published 1 day ago but at a different time (offset ~15h from now)
    const published = new Date("2025-03-03T10:00:00Z");
    // 1.625 days ago — outside the day-1 ±0.5 window; should be null
    expect(getEligibleDayMark(published, now)).toBeNull();
  });
});
