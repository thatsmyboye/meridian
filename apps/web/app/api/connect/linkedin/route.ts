import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { getCreatorSubscription, checkPlatformLimit } from "@/lib/subscription";

/**
 * GET /api/connect/linkedin
 *
 * Initiates the LinkedIn OAuth 2.0 flow. The authenticated creator is
 * redirected to LinkedIn's consent screen requesting scopes to read their
 * profile and publish posts on their behalf.
 *
 * CSRF protection: a random nonce is stored in a short-lived HTTP-only
 * cookie and passed as the `state` parameter. The callback verifies the
 * match before proceeding.
 *
 * Required env vars:
 *   LINKEDIN_CLIENT_ID    – LinkedIn OAuth 2.0 client ID
 *   NEXT_PUBLIC_SITE_URL  – Production base URL (e.g. https://app.meridian.so)
 */

const LINKEDIN_SCOPES = [
  "openid",       // OpenID Connect – identity token
  "profile",      // Access name, headline, photo
  "email",        // Access email address
  "w_member_social", // Create, modify, and delete posts
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
        .eq("platform", "linkedin");
      // Allow reconnect but block new connections when at limit
      if ((count ?? 0) === 0) {
        return NextResponse.redirect(
          `${siteUrl}/connect?error=platform_limit_reached`
        );
      }
    }
  }

  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${siteUrl}/api/connect/linkedin/callback`,
    scope: LINKEDIN_SCOPES,
    state,
  });

  const response = NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );

  response.cookies.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
