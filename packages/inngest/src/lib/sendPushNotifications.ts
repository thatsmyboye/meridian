/**
 * Send Expo push notifications to all registered devices for a creator.
 *
 * Uses the Expo Push Notification HTTP API directly (no SDK dependency).
 * Tokens are stored in the `push_tokens` table by the mobile app on each launch.
 *
 * Failures are logged but not thrown — push notifications are best-effort.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
  badge?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Send a push notification to all devices registered for `creatorId`.
 *
 * @param creatorId  - UUID of the creator to notify.
 * @param title      - Notification title.
 * @param body       - Notification body text.
 * @param data       - Optional key-value data passed to the app on tap
 *                     (e.g. `{ screen: "insights" }` for deep linking).
 */
export async function sendPushNotificationsToCreator(
  creatorId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Load all registered push tokens for this creator.
  const { data: rows, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("creator_id", creatorId);

  if (error) {
    console.error(
      `[push] Failed to load tokens for creator ${creatorId}: ${error.message}`
    );
    return;
  }

  const tokens = (rows ?? []).map((r) => r.token as string);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: "default",
    ...(data ? { data } : {}),
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.error(
        `[push] Expo Push API returned ${res.status} for creator ${creatorId}`
      );
      return;
    }

    const json = (await res.json()) as { data: ExpoPushTicket[] };
    const tickets = json.data ?? [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === "error") {
        console.warn(
          `[push] Ticket error for token ${tokens[i]}: ${ticket.message}`
        );
        // If the token is invalid/expired, remove it from the DB.
        if (
          ticket.details?.error === "DeviceNotRegistered" ||
          ticket.details?.error === "InvalidCredentials"
        ) {
          await supabase
            .from("push_tokens")
            .delete()
            .eq("creator_id", creatorId)
            .eq("token", tokens[i]);
        }
      }
    }
  } catch (err) {
    // Network error — log and swallow so Inngest doesn't retry the whole step.
    console.error(`[push] Failed to send notifications for creator ${creatorId}:`, err);
  }
}
