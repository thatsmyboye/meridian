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
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .catch(() => {
        // SecureStore read error, corrupted data, etc. — treat as no session.
        setSession(null);
      })
      .finally(() => {
        setInitialised(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Update session immediately so we don't overwrite newer state (e.g. SIGNED_OUT
        // from server-side revocation) after a delayed provisionCreator round-trip.
        setSession(session);
        router.replace("/");
        provisionCreator(supabase, session.user).catch((err) =>
          console.error("[auth] provisionCreator failed:", err)
        );
        return;
      }

      setSession(session);

      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }

      if (event === "TOKEN_REFRESHED") {
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
      {!session && pathname !== "/login" && <Redirect href="/login" />}
      {session && pathname === "/login" && <Redirect href="/" />}
      <Stack>
        <Stack.Screen name="index" options={{ title: "Meridian" }} />
        <Stack.Screen name="login" options={{ title: "Sign in", headerShown: false }} />
      </Stack>
    </>
  );
}
