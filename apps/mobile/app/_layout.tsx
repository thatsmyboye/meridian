import { provisionCreator } from "@meridian/api";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Redirect, Stack, router, usePathname } from "expo-router";
import { useEffect, useState } from "react";

/**
 * Root layout — owns the auth session lifecycle for the entire app.
 *
 * Responsibilities:
 *  - Initialise from a persisted SecureStore session on mount.
 *  - Navigate to /login when the user is not authenticated.
 *  - Navigate to / (index) after a successful sign-in.
 *  - On first sign-in (SIGNED_IN + no existing creators row), provision the
 *    creators profile using the Google user metadata.
 *  - Listen for TOKEN_REFRESHED events so the UI stays consistent after
 *    background JWT rotation by the Supabase client.
 */
export default function RootLayout() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    // Restore session from SecureStore on mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialised(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (event === "SIGNED_IN" && session?.user) {
        await provisionCreator(supabase, session.user);
        router.replace("/");
      }

      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }

      if (event === "TOKEN_REFRESHED") {
        // The Supabase client has rotated the access + refresh tokens.
        // The new tokens are already persisted in SecureStore by the client.
        // No additional action is required; state update above keeps the UI current.
        console.log("[auth] token refreshed for user:", session?.user?.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // This prevents a brief flash of authenticated routes before redirecting to /login.
  if (!initialised) {
    return null;
  }

  return (
    <>
      {!session && <Redirect href="/login" />}
      {session && pathname === "/login" && <Redirect href="/" />}
      <Stack>
        <Stack.Screen name="index" options={{ title: "Meridian" }} />
        <Stack.Screen name="login" options={{ title: "Sign in", headerShown: false }} />
      </Stack>
    </>
  );
}
