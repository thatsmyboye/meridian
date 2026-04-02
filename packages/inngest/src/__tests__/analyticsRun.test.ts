/**
 * Analytics Run — Unit Tests
 *
 * Validates the multi-platform eligibility logic used by:
 *   POST /api/analytics/run  (apps/web/app/api/analytics/run/route.ts)
 *
 * The eligibility check ensures a creator has synced content from at least
 * 2 distinct platforms before an on-demand analysis can be triggered.
 *
 * All tests are pure-logic — no network calls, no Supabase, no Inngest
 * runtime required.
 */

import { describe, it, expect } from "vitest";

// ─── Helper: mirrors the eligibility check in the API route ───────────────────
//
// Production equivalent (apps/web/app/api/analytics/run/route.ts):
//
//   const distinctPlatforms = new Set(platformRows.map(r => r.platform));
//   if (distinctPlatforms.size < 2) { return 422; }
//
// Defined locally so the test is decoupled from the route's internal structure,
// following the same pattern used in instagram-functions.test.ts.

function hasSufficientPlatforms(platforms: string[]): boolean {
  return new Set(platforms).size >= 2;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("hasSufficientPlatforms — on-demand analysis eligibility", () => {
  it("returns false when there are no platforms (brand-new creator)", () => {
    expect(hasSufficientPlatforms([])).toBe(false);
  });

  it("returns false when there is only one platform", () => {
    expect(hasSufficientPlatforms(["youtube"])).toBe(false);
  });

  it("returns false when all content items are from the same platform", () => {
    expect(hasSufficientPlatforms(["youtube", "youtube", "youtube"])).toBe(
      false
    );
  });

  it("returns true when there are exactly 2 distinct platforms", () => {
    expect(hasSufficientPlatforms(["youtube", "instagram"])).toBe(true);
  });

  it("returns true when there are more than 2 distinct platforms", () => {
    expect(
      hasSufficientPlatforms(["youtube", "instagram", "beehiiv"])
    ).toBe(true);
  });

  it("is not fooled by many items from only 2 platforms", () => {
    const platforms = [
      "youtube",
      "youtube",
      "youtube",
      "instagram",
      "instagram",
    ];
    expect(hasSufficientPlatforms(platforms)).toBe(true);
  });

  it("correctly counts 3 distinct platforms across many content items", () => {
    const platforms = Array.from(
      { length: 12 },
      (_, i) => ["youtube", "instagram", "beehiiv"][i % 3]
    ) as string[];
    expect(hasSufficientPlatforms(platforms)).toBe(true);
  });

  it("treats platform strings as case-sensitive (youtube ≠ YouTube)", () => {
    // Platform values from the database are always lowercase per the schema enum,
    // but this confirms the Set-based comparison behaves as expected.
    expect(hasSufficientPlatforms(["youtube", "YouTube"])).toBe(true);
  });
});
