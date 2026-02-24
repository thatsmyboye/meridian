"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { isSafeRedirectPath } from "@/lib/auth";

/**
 * Login page — triggers the Google OAuth PKCE flow.
 * After the user authorises access, Google redirects to /auth/callback
 * which completes the code exchange and provisions the creators profile.
 * Preserves the `next` query param so users arriving at /login?next=... are
 * redirected there after auth.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  async function handleGoogleSignIn() {
    const nextRaw = searchParams.get("next") ?? "/";
    const next = isSafeRedirectPath(nextRaw) ? nextRaw : "/";
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (next !== "/") {
      callbackUrl.searchParams.set("next", next);
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main>
        <h1>Sign in to Meridian</h1>
        <button disabled>Sign in with Google</button>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
