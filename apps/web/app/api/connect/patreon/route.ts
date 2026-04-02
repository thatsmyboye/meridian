import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { getCreatorSubscription, checkPlatformLimit } from "@/lib/subscription";

/**
 * GET /api/connect/patreon
 *
 * Initiates the Patreon OAuth 2.0 flow. The authenticated creator is
 * redirected to Patreon's consent screen requesting identity and campaign
 * scopes so Meridian can sync their posts and publish patron updates.
 *
 * CSRF protection: a random nonce is generated, stored in a short-lived
 * HTTP-only cookie, and passed as the `state` parameter to Patreon. The
 * callback verifies the returned state matches the cookie before proceeding.
 *
 * Required env vars:
 *   PATREON_CLIENT_ID     – Patreon OAuth client ID
 *   NEXT_PUBLIC_SITE_URL  – Production base URL (e.g. https://meridian.banton-digital.com)
 */

// Read access to identity + campaigns + posts; write access to publish posts.
const PATREON_SCOPES = [
  "identity",
  "identity[email]",
  "campaigns",
  "campaigns.posts",
  "w:campaigns.posts",
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
        .eq("platform", "patreon");
      // Allow reconnect but block new connections when at limit
      if ((count ?? 0) === 0) {
        return NextResponse.redirect(
          `${siteUrl}/connect?error=platform_limit_reached`
        );
      }
    }
  }

  if (!process.env.PATREON_CLIENT_ID) {
    console.error("[patreon] PATREON_CLIENT_ID env var is not set");
    return NextResponse.redirect(
      `${siteUrl}/connect?error=oauth_not_configured`
    );
  }

  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.PATREON_CLIENT_ID,
    redirect_uri: `${siteUrl}/api/connect/patreon/callback`,
    scope: PATREON_SCOPES,
    state,
  });

  const response = NextResponse.redirect(
    `https://www.patreon.com/oauth2/authorize?${params.toString()}`
  );

  response.cookies.set("patreon_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
