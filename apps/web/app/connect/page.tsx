/**
 * /connect – Platform connection page
 *
 * Server component: fetches the creator's subscription tier and current
 * platform connections, then renders ConnectPageClient with that data.
 *
 * Supports YouTube, Instagram, Substack, Beehiiv, Twitter/X, TikTok, and LinkedIn.
 * Shows success/error feedback via query params set by the connection routes.
 */

import { createServerClient } from "@/lib/supabase/server";
import { TIER_LIMITS } from "@/lib/subscription";
import type { SubscriptionTier } from "@/lib/subscription";
import ConnectPageClient, { type ConnectedPlatformRow } from "./ConnectPageClient";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "The OAuth response was incomplete. Please try again.",
  state_mismatch: "Security check failed. Please try again.",
  token_exchange_failed: "Could not complete authentication. Please try again.",
  channel_fetch_failed: "Connected to Google but could not retrieve your YouTube channel.",
  no_youtube_channel: "No YouTube channel is associated with that Google account.",
  no_facebook_pages_granted:
    "Meridian wasn't granted access to any of your Facebook Pages. " +
    "Please click Connect again and, when Meta asks which Pages to give access to, " +
    "make sure to select the Facebook Page that has your Instagram account linked.",
  no_instagram_business_account:
    "Your Facebook Pages were found but none have an Instagram Business or Creator account linked. " +
    "To fix this: go to your Facebook Page → Settings → Linked accounts → Instagram and connect " +
    "your Instagram account from there. Also confirm your Instagram account type is set to " +
    "Business or Creator (not Personal), then click Connect again.",
  instagram_account_fetch_failed:
    "Connected to Meta but could not retrieve your Instagram account details.",
  creator_not_found: "Your creator profile was not found. Please sign out and back in.",
  save_failed: "Connected successfully but could not save credentials. Please try again.",
  missing_verifier: "Session expired during authorisation. Please try again.",
  user_fetch_failed: "Connected to X but could not retrieve your account details. Please try again.",
  access_denied: "You cancelled the authorisation request.",
  invalid_credentials: "The API key or publication ID you entered is not valid. Please check and try again.",
  unauthenticated: "You must be signed in to connect a platform.",
  oauth_not_configured: "This platform is not yet configured. Please contact support.",
};

interface ConnectPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const { success, error } = await searchParams;

  // ── Fetch tier + platform data server-side ──────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier: SubscriptionTier = "free";
  let creatorId = "";
  let initialRows: ConnectedPlatformRow[] = [];
  let activePlatformCount = 0;

  if (user) {
    const { data: creator } = await supabase
      .from("creators")
      .select("id, subscription_tier")
      .eq("auth_user_id", user.id)
      .single();

    if (creator) {
      tier = (creator.subscription_tier as SubscriptionTier) ?? "free";
      creatorId = creator.id;

      const [{ data: rows }, { count }] = await Promise.all([
        supabase
          .from("connected_platforms")
          .select("platform, platform_username, status, last_synced_at, last_sync_count")
          .eq("creator_id", creator.id),
        supabase
          .from("connected_platforms")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", creator.id)
          .neq("status", "disconnected"),
      ]);

      initialRows = (rows ?? []) as ConnectedPlatformRow[];
      activePlatformCount = count ?? 0;
    }
  }

  const platformLimit = TIER_LIMITS[tier].platforms;
  const showLimitModal = error === "platform_limit_reached";

  // Non-limit errors get a banner message; limit errors open the modal
  const errorMessage =
    error && error !== "platform_limit_reached"
      ? (ERROR_MESSAGES[error] ?? "An unexpected error occurred. Please try again.")
      : null;

  // Derive which platform the error originated from so the UI can show a
  // platform-specific "Try again" link alongside the error banner.
  const INSTAGRAM_ERRORS = new Set([
    "no_facebook_pages_granted",
    "no_instagram_business_account",
    "instagram_account_fetch_failed",
    "token_exchange_failed",
    "missing_params",
    "state_mismatch",
  ]);
  const errorPlatform = error && INSTAGRAM_ERRORS.has(error) ? "instagram" : null;

  return (
    <ConnectPageClient
      creatorId={creatorId}
      initialRows={initialRows}
      showLimitModal={showLimitModal}
      tier={tier}
      activePlatformCount={activePlatformCount}
      platformLimit={platformLimit === Infinity ? 999 : platformLimit}
      errorMessage={errorMessage}
      errorPlatform={errorPlatform}
      successPlatform={success ?? null}
    />
  );
}
