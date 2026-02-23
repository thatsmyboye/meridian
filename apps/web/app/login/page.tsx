"use client";

import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Login page — triggers the Google OAuth PKCE flow.
 * After the user authorises access, Google redirects to /auth/callback
 * which completes the code exchange and provisions the creators profile.
 */
export default function LoginPage() {
  const supabase = createBrowserClient();

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main>
      <h1>Sign in to Meridian</h1>
      <button onClick={handleGoogleSignIn}>Sign in with Google</button>
    </main>
  );
}
