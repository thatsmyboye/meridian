import "../global.css";
import { provisionCreator } from "@meridian/api";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import type { Session } from "@supabase/supabase-js";
import { Redirect, Stack, router, usePathname } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";

/**
 * Root layout — owns the auth session lifecycle for the entire app.
 *
 * Responsibilities:
 *  - Initialise from a persisted (encrypted) session on mount.
 *  - Navigate to /login when the user is not authenticated.
 *  - Navigate to /(tabs) after a successful sign-in.
 *  - On first sign-in (SIGNED_IN + no existing creators row), provision the
 *    creators profile using the Google user metadata.
 *  - Register the device for push notifications after sign-in and store the
 *    Expo Push Token in Supabase so Inngest jobs can target this device.
 *  - Listen for TOKEN_REFRESHED events so the UI stays consistent after
 *    background JWT rotation by the Supabase client.
 *  - Handle notification taps to deep-link to the relevant screen.
 */
export default function RootLayout() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [initialised, setInitialised] = useState(false);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Restore session from storage on mount.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .catch(() => {
        // Storage read error, corrupted data, etc. — treat as no session.
        setSession(null);
      })
      .finally(() => {
        setInitialised(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Update session immediately so we don't overwrite newer state (e.g. SIGNED_OUT
        // from server-side revocation) after a delayed provisionCreator round-trip.
        setSession(session);
        try {
          await provisionCreator(supabase, session.user);

          // Fetch the creator row to get the creator ID for push token registration.
          const { data: creator } = await supabase
            .from("creators")
            .select("id")
            .eq("auth_user_id", session.user.id)
            .single();

          if (creator?.id) {
            // Fire-and-forget: token registration is best-effort.
            registerForPushNotifications(supabase, creator.id as string).catch(
              (err) => console.warn("[auth] push registration failed:", err)
            );
          }
        } catch (err) {
          console.error("[auth] provisionCreator failed:", err);
        }
        router.replace("/(tabs)");
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

    // Handle notification taps — deep-link to the relevant screen.
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | Record<string, string>
          | undefined;
        const screen = data?.screen;
        if (screen === "insights") {
          router.push("/(tabs)/insights");
        } else if (screen === "review") {
          router.push("/(tabs)/review");
        }
      });

    return () => {
      subscription.unsubscribe();
      notificationResponseListener.current?.remove();
    };
  }, []);

  // This prevents a brief flash of authenticated routes before redirecting to /login.
  if (!initialised) {
    return null;
  }

  return (
    <>
      {!session && pathname !== "/login" && <Redirect href="/login" />}
      {session && pathname === "/login" && <Redirect href="/(tabs)" />}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Sign in", headerShown: false }} />
      </Stack>
    </>
  );
}
