import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { getCreatorSubscription, checkPlatformLimit } from "@/lib/subscription";

/**
 * GET /api/connect/twitter
 *
 * Initiates the Twitter/X OAuth 2.0 + PKCE flow. The authenticated creator
 * is redirected to Twitter's consent screen requesting tweet.write and
 * users.read scopes so Meridian can post tweet threads on their behalf.
 *
 * CSRF + PKCE protection:
 *   - A random state nonce is stored in a short-lived HTTP-only cookie and
 *     passed as the `state` parameter. The callback verifies the match.
 *   - A PKCE code_verifier is generated and stored in a cookie; the
 *     code_challenge (S256) is sent to Twitter. The callback sends the
 *     verifier when exchanging the code for tokens.
 *
 * Required env vars:
 *   TWITTER_CLIENT_ID     – Twitter OAuth 2.0 client ID
 *   NEXT_PUBLIC_SITE_URL  – Production base URL (e.g. https://meridian.banton-digital.com)
 */

const TWITTER_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access", // grants a refresh token
].join(" ");

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
        .eq("platform", "twitter");
      // Allow reconnect but block new connections when at limit
      if ((count ?? 0) === 0) {
        return NextResponse.redirect(
          `${siteUrl}/connect?error=platform_limit_reached`
        );
      }
    }
  }

  if (!process.env.TWITTER_CLIENT_ID) {
    console.error("[twitter] TWITTER_CLIENT_ID env var is not set");
    return NextResponse.redirect(`${siteUrl}/connect?error=oauth_not_configured`);
  }

  // ── PKCE: generate code_verifier and code_challenge ───────────────────────
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.TWITTER_CLIENT_ID,
    redirect_uri: `${siteUrl}/api/connect/twitter/callback`,
    scope: TWITTER_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  );

  response.cookies.set("twitter_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  response.cookies.set("twitter_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
