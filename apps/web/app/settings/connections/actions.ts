"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set([
  "youtube",
  "instagram",
  "beehiiv",
  "tiktok",
  "twitter",
  "linkedin",
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
