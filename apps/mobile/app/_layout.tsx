import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Stack, router } from "expo-router";
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
        await provisionCreatorIfNew(session.user.id, session.user);
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

  // Wait until we know whether there is a session before rendering screens.
  useEffect(() => {
    if (!initialised) return;
    if (!session) {
      router.replace("/login");
    }
  }, [initialised, session]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Meridian" }} />
      <Stack.Screen name="login" options={{ title: "Sign in", headerShown: false }} />
    </Stack>
  );
}

/**
 * Inserts a creators row on the user's very first sign-in.
 * Subsequent sign-ins skip the insert (row already exists).
 */
async function provisionCreatorIfNew(
  userId: string,
  user: { email?: string; user_metadata?: Record<string, unknown> }
) {
  const { data: existing } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (existing) return;

  const meta = user.user_metadata ?? {};
  const { error } = await supabase.from("creators").insert({
    auth_user_id: userId,
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

  if (error) {
    console.error("[auth] creators insert failed:", error.message);
  }
}
