import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/instagram
 *
 * Initiates the Instagram OAuth flow via Meta's Facebook Login. The
 * authenticated creator is redirected to Facebook's consent screen
 * requesting Instagram Business/Creator scopes.
 *
 * CSRF protection: a random nonce is stored in a short-lived HTTP-only
 * cookie and passed as the `state` parameter. The callback verifies the
 * returned state before proceeding.
 *
 * Required env vars:
 *   META_APP_ID           – Meta app ID (from developers.facebook.com)
 *   NEXT_PUBLIC_SITE_URL  – Production base URL (e.g. https://app.meridian.so)
 */

const META_GRAPH_VERSION = "v21.0";

/**
 * Scopes required for Instagram Business/Creator accounts:
 *   instagram_basic           – read profile, media list and metadata
 *   instagram_manage_insights – read media and account-level insights
 *   pages_show_list           – enumerate Facebook Pages to find the
 *                               linked Instagram Business account
 *   pages_read_engagement     – required alongside pages_show_list to
 *                               access page-scoped Instagram data
 */
const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

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

  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${siteUrl}/api/connect/instagram/callback`,
    response_type: "code",
    scope: INSTAGRAM_SCOPES,
    state,
  });

  const response = NextResponse.redirect(
    `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`
  );

  response.cookies.set("instagram_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes – long enough for the user to complete consent
    path: "/",
  });

  return response;
}
