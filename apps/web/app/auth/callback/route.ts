import { provisionCreator } from "@meridian/api";
import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isSafeRedirectPath } from "@/lib/auth";

/**
 * OAuth callback handler for Supabase Auth PKCE flow.
 *
 * Google redirects here after the user grants access. This route:
 *  1. Exchanges the auth code for a session.
 *  2. On first sign-in, inserts a row into the `creators` table using
 *     profile data returned by Google.
 *  3. Redirects to the `next` param (defaults to "/").
 *
 * Required Google Cloud Console settings:
 *  - Authorised redirect URI: <SITE_URL>/auth/callback
 */

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const nextRaw = searchParams.get("next") ?? "/";

  // Prevent open-redirect: only allow relative paths starting with a single "/".
  const next = isSafeRedirectPath(nextRaw) ? nextRaw : "/";

  // Handle OAuth provider errors (e.g. user denied access, or Supabase failed to
  // exchange the external code). Surface these to the user rather than silently
  // dropping them.
  if (oauthError) {
    const errorDescription = searchParams.get("error_description") ?? oauthError;
    console.error("[auth/callback] OAuth error:", oauthError, errorDescription);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", oauthError);
    loginUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(loginUrl.toString());
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createServerClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await provisionCreator(supabase, user);
    } catch (err) {
      console.error("[auth/callback] provisionCreator failed:", err);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
