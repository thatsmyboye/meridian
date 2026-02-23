import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
  const next = searchParams.get("next") ?? "/";

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
    // Check whether a creators row already exists for this user.
    const { data: existingCreator } = await supabase
      .from("creators")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!existingCreator) {
      // First sign-in: provision the creators profile from Google metadata.
      const meta = user.user_metadata ?? {};
      const { error: insertError } = await supabase.from("creators").insert({
        auth_user_id: user.id,
        display_name:
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          user.email?.split("@")[0] ??
          "Creator",
        email: user.email!,
        avatar_url:
          (meta.avatar_url as string | undefined) ??
          (meta.picture as string | undefined) ??
          null,
      });

      if (insertError) {
        console.error("[auth/callback] creators insert failed:", insertError.message);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
