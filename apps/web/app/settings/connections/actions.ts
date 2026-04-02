"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { inngest } from "@meridian/inngest";
import type { Platform } from "@meridian/types";

const VALID_PLATFORMS = new Set([
  "youtube",
  "instagram",
  "beehiiv",
  "substack",
  "tiktok",
  "twitter",
  "linkedin",
  "patreon",
]);

/** Platforms that have a dedicated content sync Inngest function. */
const SYNCABLE_PLATFORMS = new Set([
  "youtube",
  "instagram",
  "beehiiv",
  "substack",
  "tiktok",
  "linkedin",
  "patreon",
]);

/**
 * Disconnects a platform by clearing its tokens and marking status as
 * 'disconnected'. The row is preserved so re-connection history is retained.
 */
export async function disconnectPlatform(platform: string) {
  if (!VALID_PLATFORMS.has(platform)) {
    throw new Error(`Invalid platform: ${platform}`);
  }

  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (creatorErr || !creator) return;

  await supabase
    .from("connected_platforms")
    .update({
      status: "disconnected",
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
    })
    .eq("creator_id", creator.id)
    .eq("platform", platform);

  revalidatePath("/settings/connections");
}

/**
 * Triggers an ad-hoc content sync for a connected platform by sending a
 * `content/sync.requested` event to Inngest.
 *
 * Only platforms with a dedicated sync function (YouTube, Instagram, Beehiiv,
 * Substack, LinkedIn) are supported; for others this is a no-op.
 * The platform must be in 'active' status — reauth-required or disconnected
 * platforms are silently ignored.
 */
export async function requestPlatformSync(platform: string) {
  if (!VALID_PLATFORMS.has(platform) || !SYNCABLE_PLATFORMS.has(platform)) return;

  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) return;

  const { data: conn } = await supabase
    .from("connected_platforms")
    .select("id")
    .eq("creator_id", creator.id)
    .eq("platform", platform)
    .eq("status", "active")
    .single();

  if (!conn) return;

  await inngest.send({
    name: "content/sync.requested",
    data: {
      creator_id: creator.id,
      connected_platform_id: conn.id,
      platform: platform as Platform,
    },
  });
}
