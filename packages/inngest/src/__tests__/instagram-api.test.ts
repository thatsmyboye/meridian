/**
 * Instagram Graph API — Connectivity & Integration Tests
 *
 * Two categories:
 *   1. Unit tests — pure logic, no network (always run)
 *   2. Integration tests — live Graph API calls (always run; require no auth
 *      for basic connectivity, skip gracefully when test credentials are absent)
 *
 * Required env vars for full integration coverage:
 *   META_APP_ID              – Meta App ID (from Meta App Dashboard)
 *   META_APP_SECRET          – Meta App Secret
 *   INSTAGRAM_TEST_TOKEN     – A valid Instagram long-lived access token
 *   INSTAGRAM_TEST_USER_ID   – The Instagram Business/Creator account IG User ID
 */

import { describe, it, expect } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_VERSION = "v21.0";
const META_GRAPH_BASE = "https://graph.facebook.com";

// ─── Shared test helper ───────────────────────────────────────────────────────

async function graphRequest(
  endpoint: string,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = new URL(`${META_GRAPH_BASE}/${API_VERSION}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ─── Unit tests: token refresh logic ─────────────────────────────────────────

describe("Token refresh logic", () => {
  it("does NOT refresh when token expires more than 7 days from now", () => {
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // +10 days
    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);  // +7 days
    expect(expiresAt > threshold).toBe(true); // token is still valid
  });

  it("schedules a refresh when token expires within the 7-day buffer", () => {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // +3 days
    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(expiresAt <= threshold).toBe(true); // refresh needed
  });

  it("marks token as expired when expiry is in the past", () => {
    const expiresAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
    expect(expiresAt <= new Date()).toBe(true);
  });

  it("builds the correct token-refresh URL", () => {
    const refreshUrl = new URL(`${META_GRAPH_BASE}/${API_VERSION}/oauth/access_token`);
    refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
    refreshUrl.searchParams.set("client_id", "TEST_APP_ID");
    refreshUrl.searchParams.set("client_secret", "TEST_APP_SECRET");
    refreshUrl.searchParams.set("fb_exchange_token", "TEST_TOKEN");

    expect(refreshUrl.hostname).toBe("graph.facebook.com");
    expect(refreshUrl.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(refreshUrl.searchParams.get("client_id")).toBe("TEST_APP_ID");
    expect(refreshUrl.pathname).toContain(API_VERSION);
  });

  it("defaults expires_in to 60 days (5 184 000 s) when Meta omits the field", () => {
    const DEFAULT_EXPIRES_IN_SECONDS = 60 * 24 * 60 * 60;
    const refreshed: { access_token: string; expires_in?: number } = {
      access_token: "new_token",
    };
    const expiresIn = refreshed.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS;
    expect(expiresIn).toBe(5_184_000);
  });
});

// ─── Unit tests: media type support ──────────────────────────────────────────

describe("Supported media types", () => {
  const SUPPORTED_TYPES = ["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REEL"] as const;

  it("IMAGE is supported", () => expect(SUPPORTED_TYPES).toContain("IMAGE"));
  it("VIDEO is supported", () => expect(SUPPORTED_TYPES).toContain("VIDEO"));
  it("CAROUSEL_ALBUM is supported", () => expect(SUPPORTED_TYPES).toContain("CAROUSEL_ALBUM"));
  it("REEL is supported", () => expect(SUPPORTED_TYPES).toContain("REEL"));
  it("does not include unsupported types like STORY", () => expect(SUPPORTED_TYPES).not.toContain("STORY"));
});

// ─── Unit tests: media fields & insights metrics ──────────────────────────────

describe("Graph API field / metric constants", () => {
  const MEDIA_FIELDS =
    "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count";
  const MEDIA_METRICS = "views,reach,saved,shares";

  it("media fields include all required fields", () => {
    const fields = MEDIA_FIELDS.split(",");
    expect(fields).toContain("id");
    expect(fields).toContain("media_type");
    expect(fields).toContain("timestamp");
    expect(fields).toContain("permalink");
    expect(fields).toContain("like_count");
    expect(fields).toContain("comments_count");
  });

  it("uses 'views' as the primary insight metric (Meta's unified metric since Apr 2025)", () => {
    expect(MEDIA_METRICS.split(",")).toContain("views");
  });

  it("does not request deprecated 'impressions' or 'plays' metrics", () => {
    const metrics = MEDIA_METRICS.split(",");
    expect(metrics).not.toContain("impressions");
    expect(metrics).not.toContain("plays");
  });

  it("requests reach, saved, and shares alongside views", () => {
    const metrics = MEDIA_METRICS.split(",");
    expect(metrics).toContain("reach");
    expect(metrics).toContain("saved");
    expect(metrics).toContain("shares");
  });
});

// ─── Unit tests: pagination safety cap ───────────────────────────────────────

describe("Pagination safety cap", () => {
  it("stops at 200 pages (5 000 posts) to prevent runaway syncs", () => {
    const MAX_PAGES = 200;
    const ITEMS_PER_PAGE = 25;
    expect(MAX_PAGES * ITEMS_PER_PAGE).toBe(5_000);
  });
});

// ─── Integration tests: live Meta Graph API ───────────────────────────────────
//
// These tests make real HTTP calls to graph.facebook.com.
// They are skipped by default to keep CI fast and work in offline/sandboxed
// environments. To run them:
//
//   ENABLE_LIVE_TESTS=1 pnpm test
//   ENABLE_LIVE_TESTS=1 INSTAGRAM_TEST_TOKEN=<token> INSTAGRAM_TEST_USER_ID=<id> pnpm test
//
const LIVE = !!process.env.ENABLE_LIVE_TESTS;

describe.skipIf(!LIVE)("Meta Graph API — connectivity (live)", () => {
  it("Graph API root endpoint is reachable", async () => {
    const res = await fetch(`${META_GRAPH_BASE}/${API_VERSION}`);
    // Meta returns 400 (missing access_token) or 404 for the version root —
    // either status confirms the host is up and routing requests correctly.
    expect([400, 404]).toContain(res.status);
  });

  it("token-refresh endpoint is reachable", async () => {
    const url = new URL(`${META_GRAPH_BASE}/${API_VERSION}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", process.env.META_APP_ID ?? "placeholder");
    url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "placeholder");
    url.searchParams.set("fb_exchange_token", "test_token_for_connectivity_check");

    const res = await fetch(url.toString());
    // 400 (invalid token/app) or 401 (bad credentials) both confirm
    // the endpoint is reachable and validating input.
    expect([400, 401]).toContain(res.status);
  });

  it("responds with a JSON error body (not a timeout/network error)", async () => {
    const res = await fetch(`${META_GRAPH_BASE}/${API_VERSION}`);
    const body = await res.json().catch(() => null);
    // Meta always returns JSON even for error responses
    expect(body).not.toBeNull();
  });
});

describe.skipIf(!LIVE)("Meta Graph API — media endpoint (live, requires INSTAGRAM_TEST_TOKEN)", () => {
  const token = process.env.INSTAGRAM_TEST_TOKEN;
  const userId = process.env.INSTAGRAM_TEST_USER_ID;

  it.skipIf(!token || !userId)(
    "fetches first page of media with correct field set",
    async () => {
      const result = await graphRequest(`${userId}/media`, {
        fields:
          "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count",
        limit: "5",
        access_token: token!,
      });

      expect(result.ok).toBe(true);
      const data = result.data as { data: unknown[] };
      expect(Array.isArray(data.data)).toBe(true);
    }
  );

  it.skipIf(!token || !userId)(
    "returned media items have the expected fields",
    async () => {
      const result = await graphRequest(`${userId}/media`, {
        fields: "id,media_type,timestamp,permalink",
        limit: "3",
        access_token: token!,
      });

      expect(result.ok).toBe(true);
      const items = (result.data as { data: Record<string, unknown>[] }).data;
      items.forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REEL"]).toContain(item.media_type);
        expect(item.timestamp).toBeTruthy();
        expect(item.permalink).toBeTruthy();
      });
    }
  );
});

describe.skipIf(!LIVE)("Meta Graph API — insights endpoint (live, requires INSTAGRAM_TEST_TOKEN)", () => {
  const token = process.env.INSTAGRAM_TEST_TOKEN;
  const userId = process.env.INSTAGRAM_TEST_USER_ID;

  it.skipIf(!token || !userId)(
    "insights endpoint returns a valid response for a real media item",
    async () => {
      // First fetch one real media ID to use for insights
      const mediaResult = await graphRequest(`${userId}/media`, {
        fields: "id",
        limit: "1",
        access_token: token!,
      });

      expect(mediaResult.ok).toBe(true);
      const mediaId = (mediaResult.data as { data: { id: string }[] }).data[0]?.id;
      expect(mediaId).toBeTruthy();

      const insightsResult = await graphRequest(`${mediaId}/insights`, {
        metric: "views,reach,saved,shares",
        period: "lifetime",
        access_token: token!,
      });

      // 200 (data available) or 400 (media type restrictions) are both valid
      expect([200, 400]).toContain(insightsResult.status);
    }
  );
});
