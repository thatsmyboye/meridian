import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/connect/youtube
 *
 * Initiates the YouTube OAuth flow. The authenticated creator is redirected
 * to Google's consent screen requesting read-only YouTube and Analytics scopes.
 *
 * CSRF protection: a random nonce is generated, stored in a short-lived
 * HTTP-only cookie, and passed as the `state` parameter to Google. The callback
 * verifies the returned state matches the cookie before proceeding.
 *
 * Required env vars:
 *   YOUTUBE_CLIENT_ID     – Google OAuth client ID
 *   NEXT_PUBLIC_SITE_URL  – Production base URL (e.g. https://app.meridian.so)
 */

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
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

  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID!,
    redirect_uri: `${siteUrl}/api/connect/youtube/callback`,
    response_type: "code",
    scope: YOUTUBE_SCOPES,
    access_type: "offline",
    prompt: "consent", // always re-prompt so Google issues a fresh refresh token
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set("youtube_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes – long enough for the user to complete consent
    path: "/",
  });

  return response;
}
