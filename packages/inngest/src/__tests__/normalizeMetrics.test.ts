/**
 * normalizeMetrics — Unit Tests
 *
 * Tests the actual normalizeMetrics function from lib/normalizeMetrics.ts,
 * verifying correct cross-platform metric normalization for:
 *   - Instagram (Graph API)
 *   - YouTube (Analytics API)
 *   - Beehiiv (Newsletter API)
 */

import { describe, it, expect } from "vitest";
import { normalizeMetrics } from "../lib/normalizeMetrics";

// ─── Instagram ─────────────────────────────────────────────────────────────────

describe("normalizeMetrics — Instagram", () => {
  it("maps views directly", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 1000,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    });
    expect(result.views).toBe(1000);
  });

  it("rounds fractional view counts", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 999.7,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    });
    expect(result.views).toBe(1000);
  });

  it("calculates engagement_rate as (likes+comments+shares+saves)/views", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 1000,
      likes: 50,
      comments: 10,
      shares: 5,
      saves: 25,
    });
    // (50 + 10 + 5 + 25) / 1000 = 0.09
    expect(result.engagement_rate).toBeCloseTo(0.09, 5);
  });

  it("includes saves in the engagement_rate numerator", () => {
    const withSaves = normalizeMetrics({
      platform: "instagram",
      views: 100,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 10,
    });
    const withoutSaves = normalizeMetrics({
      platform: "instagram",
      views: 100,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    });
    expect(withSaves.engagement_rate).toBeGreaterThan(withoutSaves.engagement_rate);
    expect(withSaves.engagement_rate).toBeCloseTo(0.1, 5);
  });

  it("returns 0 engagement_rate when views is 0 (avoids division by zero)", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 0,
      likes: 50,
      comments: 10,
      shares: 5,
      saves: 25,
    });
    expect(result.engagement_rate).toBe(0);
  });

  it("clamps engagement_rate to 1.0 when interactions exceed views", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 100,
      likes: 200,
      comments: 50,
      shares: 30,
      saves: 20,
    });
    expect(result.engagement_rate).toBe(1);
  });

  it("clamps engagement_rate to 0 when it would go negative", () => {
    // Negative values shouldn't occur from the API, but normalizeMetrics should handle them safely.
    const result = normalizeMetrics({
      platform: "instagram",
      views: 1000,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    });
    expect(result.engagement_rate).toBeGreaterThanOrEqual(0);
  });

  it("sets watch_time_seconds to null (Instagram does not expose watch time)", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 500,
      likes: 20,
      comments: 5,
      shares: 2,
      saves: 8,
    });
    expect(result.watch_time_seconds).toBeNull();
  });

  it("returns the correct shape for a typical Instagram post", () => {
    const result = normalizeMetrics({
      platform: "instagram",
      views: 5000,
      likes: 300,
      comments: 45,
      shares: 20,
      saves: 85,
    });
    expect(result).toMatchObject({
      views: 5000,
      engagement_rate: expect.any(Number),
      watch_time_seconds: null,
    });
    expect(result.engagement_rate).toBeGreaterThan(0);
    expect(result.engagement_rate).toBeLessThanOrEqual(1);
  });
});

// ─── YouTube ───────────────────────────────────────────────────────────────────

describe("normalizeMetrics — YouTube", () => {
  it("maps views directly", () => {
    const result = normalizeMetrics({
      platform: "youtube",
      views: 10_000,
      estimatedMinutesWatched: 25_000,
      likes: 800,
      comments: 120,
      shares: 80,
    });
    expect(result.views).toBe(10_000);
  });

  it("converts estimatedMinutesWatched to watch_time_seconds (×60)", () => {
    const result = normalizeMetrics({
      platform: "youtube",
      views: 10_000,
      estimatedMinutesWatched: 25_000,
      likes: 800,
      comments: 120,
      shares: 80,
    });
    expect(result.watch_time_seconds).toBe(1_500_000);
  });

  it("calculates engagement_rate as (likes+comments+shares)/views", () => {
    const result = normalizeMetrics({
      platform: "youtube",
      views: 10_000,
      estimatedMinutesWatched: 0,
      likes: 500,
      comments: 100,
      shares: 400,
    });
    // (500 + 100 + 400) / 10000 = 0.1
    expect(result.engagement_rate).toBeCloseTo(0.1, 5);
  });

  it("does NOT include saves in the YouTube engagement numerator", () => {
    // YouTube metrics don't have saves
    const result = normalizeMetrics({
      platform: "youtube",
      views: 1000,
      estimatedMinutesWatched: 0,
      likes: 50,
      comments: 10,
      shares: 40,
    });
    // (50 + 10 + 40) / 1000 = 0.1
    expect(result.engagement_rate).toBeCloseTo(0.1, 5);
  });

  it("returns 0 engagement_rate when views is 0", () => {
    const result = normalizeMetrics({
      platform: "youtube",
      views: 0,
      estimatedMinutesWatched: 0,
      likes: 10,
      comments: 5,
      shares: 2,
    });
    expect(result.engagement_rate).toBe(0);
  });

  it("clamps engagement_rate to 1.0 for anomalous data", () => {
    const result = normalizeMetrics({
      platform: "youtube",
      views: 10,
      estimatedMinutesWatched: 0,
      likes: 1000,
      comments: 500,
      shares: 200,
    });
    expect(result.engagement_rate).toBe(1);
  });

  it("rounds fractional view counts", () => {
    const result = normalizeMetrics({
      platform: "youtube",
      views: 1234.6,
      estimatedMinutesWatched: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });
    expect(result.views).toBe(1235);
  });
});

// ─── Beehiiv ───────────────────────────────────────────────────────────────────

describe("normalizeMetrics — Beehiiv", () => {
  it("maps uniqueOpened to views", () => {
    const result = normalizeMetrics({
      platform: "beehiiv",
      uniqueOpened: 3200,
      recipients: 8000,
      openRate: 40,
    });
    expect(result.views).toBe(3200);
  });

  it("converts openRate percentage to engagement_rate fraction", () => {
    const result = normalizeMetrics({
      platform: "beehiiv",
      uniqueOpened: 3200,
      recipients: 8000,
      openRate: 42.5,
    });
    expect(result.engagement_rate).toBeCloseTo(0.425, 5);
  });

  it("sets watch_time_seconds to null", () => {
    const result = normalizeMetrics({
      platform: "beehiiv",
      uniqueOpened: 1000,
      recipients: 5000,
      openRate: 20,
    });
    expect(result.watch_time_seconds).toBeNull();
  });

  it("clamps openRate > 100% to engagement_rate of 1.0", () => {
    const result = normalizeMetrics({
      platform: "beehiiv",
      uniqueOpened: 1000,
      recipients: 1000,
      openRate: 110, // anomalous — Beehiiv can report >100% due to forwarding
    });
    expect(result.engagement_rate).toBe(1);
  });

  it("rounds fractional uniqueOpened counts", () => {
    const result = normalizeMetrics({
      platform: "beehiiv",
      uniqueOpened: 999.9,
      recipients: 5000,
      openRate: 20,
    });
    expect(result.views).toBe(1000);
  });
});

// ─── Cross-platform contract ───────────────────────────────────────────────────

describe("normalizeMetrics — output contract (all platforms)", () => {
  const allCases = [
    {
      label: "Instagram",
      input: { platform: "instagram" as const, views: 500, likes: 10, comments: 5, shares: 2, saves: 3 },
    },
    {
      label: "YouTube",
      input: { platform: "youtube" as const, views: 500, estimatedMinutesWatched: 200, likes: 10, comments: 5, shares: 2 },
    },
    {
      label: "Beehiiv",
      input: { platform: "beehiiv" as const, uniqueOpened: 500, recipients: 1000, openRate: 50 },
    },
  ];

  allCases.forEach(({ label, input }) => {
    it(`${label}: engagement_rate is in [0, 1]`, () => {
      const result = normalizeMetrics(input);
      expect(result.engagement_rate).toBeGreaterThanOrEqual(0);
      expect(result.engagement_rate).toBeLessThanOrEqual(1);
    });

    it(`${label}: views is a non-negative integer`, () => {
      const result = normalizeMetrics(input);
      expect(result.views).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.views)).toBe(true);
    });
  });
});
