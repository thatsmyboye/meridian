import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { getCreatorSubscription, checkPlatformLimit } from "@/lib/subscription";

/**
 * GET /api/connect/tiktok
 *
 * Initiates the TikTok OAuth 2.0 + PKCE flow. The authenticated creator is
 * redirected to TikTok's consent screen requesting scopes to read their
 * profile and post content on their behalf.
 *
 * CSRF + PKCE protection:
 *   - A random state nonce is stored in a short-lived HTTP-only cookie and
 *     passed as the `state` parameter. The callback verifies the match.
 *   - A PKCE code_verifier is generated and stored in a cookie; the
 *     code_challenge (S256) is sent to TikTok. The callback sends the
 *     verifier when exchanging the code for tokens.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY     – TikTok app client key (from developers.tiktok.com)
 *   NEXT_PUBLIC_SITE_URL  – Production base URL (e.g. https://meridian.banton-digital.com)
 */

// video.publish and video.upload require TikTok app approval and are unavailable
// in Sandbox mode. Set TIKTOK_SANDBOX=true to omit them during pre-approval testing.
const SANDBOX_SCOPES = [
  "user.info.basic",     // Access display name and avatar
  "user.info.profile",   // Access profile URL
  "video.list",          // Read the user's uploaded videos
];

const PRODUCTION_SCOPES = [
  "user.info.basic",     // Access display name and avatar
  "user.info.profile",   // Access profile URL
  "video.list",          // Read the user's uploaded videos
  "video.publish",       // Upload and publish videos on behalf of user (requires approval)
  "video.upload",        // Upload video files (requires approval)
];

const isSandbox = process.env.TIKTOK_SANDBOX === "true";
const TIKTOK_SCOPES = (isSandbox ? SANDBOX_SCOPES : PRODUCTION_SCOPES).join(",");

export async function GET(request: Request) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`);
  }

  // ── Platform limit gate ───────────────────────────────────────────────────
  const subscription = await getCreatorSubscription();
  if (subscription) {
    const limitCheck = await checkPlatformLimit(
      subscription.creatorId,
      subscription.tier
    );
    if (!limitCheck.allowed) {
      const supabaseCheck = await (
        await import("@/lib/supabase/server")
      ).createServerClient();
      const { count } = await supabaseCheck
        .from("connected_platforms")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", subscription.creatorId)
        .eq("platform", "tiktok");
      // Allow reconnect but block new connections when at limit
      if ((count ?? 0) === 0) {
        return NextResponse.redirect(
          `${siteUrl}/connect?error=platform_limit_reached`
        );
      }
    }
  }

  if (!process.env.TIKTOK_CLIENT_KEY) {
    console.error("[tiktok] TIKTOK_CLIENT_KEY env var is not set");
    return NextResponse.redirect(`${siteUrl}/connect?error=oauth_not_configured`);
  }

  // ── PKCE: generate code_verifier and code_challenge ───────────────────────
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const state = randomBytes(16).toString("hex");

  if (isSandbox) {
    console.warn(
      "[tiktok] SANDBOX mode: video.publish and video.upload scopes omitted — " +
      "publishing will be unavailable until the app is approved for production."
    );
  }

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: TIKTOK_SCOPES,
    redirect_uri: `${siteUrl}/api/connect/tiktok/callback`,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  );

  response.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  response.cookies.set("tiktok_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
