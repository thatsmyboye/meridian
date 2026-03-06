/**
 * Push notification utilities for Meridian mobile.
 *
 * Responsibilities:
 *  - Request push notification permissions from the OS.
 *  - Obtain the Expo Push Token for this device.
 *  - Persist the token to Supabase (push_tokens table) so Inngest jobs
 *    can send targeted push notifications.
 *  - Configure foreground notification presentation behaviour.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

// Show notifications as banners with sound when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request OS permissions, obtain the Expo Push Token, and store it in
 * Supabase for the given creator. Safe to call on every app launch —
 * the upsert is idempotent.
 *
 * @returns The Expo Push Token string, or null if permissions were denied.
 */
export async function registerForPushNotifications(
  supabase: SupabaseClient,
  creatorId: string
): Promise<string | null> {
  // Push notifications are not supported in the web/simulator without
  // a physical device and a valid project ID.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[notifications] Push permission denied.");
    return null;
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: "1916c841-542c-4ef5-b3c1-8de20525be07",
    });
    token = result.data;
  } catch (err) {
    // Running in Expo Go without a physical device, or on a simulator.
    console.warn("[notifications] Could not obtain Expo Push Token:", err);
    return null;
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";

  // Persist token to Supabase (upsert — safe to call every launch).
  const { error } = await supabase.from("push_tokens").upsert(
    { creator_id: creatorId, token, platform },
    { onConflict: "creator_id,token" }
  );

  if (error) {
    console.error("[notifications] Failed to store push token:", error.message);
  } else {
    console.log("[notifications] Push token registered:", token);
  }

  return token;
}
