/**
 * Subscription tier gating helpers (server-side only).
 *
 * Never import this file in client components — it uses the Supabase server
 * client and relies on server-side session cookies.
 */

import { createServerClient } from "@/lib/supabase/server";

// ─── Tier definitions ─────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "creator" | "pro";

export interface TierLimits {
  /** Maximum number of connected platforms. */
  platforms: number;
  /** Maximum repurpose jobs per calendar month. */
  repurposeJobsPerMonth: number;
  /** Maximum roster (team member) seats. */
  rosterSize: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    platforms: 1,
    repurposeJobsPerMonth: 5,
    rosterSize: 1,
  },
  creator: {
    platforms: 3,
    repurposeJobsPerMonth: 20,
    rosterSize: 3,
  },
  pro: {
    platforms: Infinity,
    repurposeJobsPerMonth: Infinity,
    rosterSize: Infinity,
  },
};

// ─── Server-side gate helpers ─────────────────────────────────────────────────

/**
 * Fetch the authenticated creator's subscription tier and database ID.
 * Returns null if the user is not authenticated or has no creator profile.
 */
export async function getCreatorSubscription(): Promise<{
  creatorId: string;
  tier: SubscriptionTier;
} | null> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: creator } = await supabase
    .from("creators")
    .select("id, subscription_tier")
    .eq("auth_user_id", user.id)
    .single();

  if (!creator) return null;

  return {
    creatorId: creator.id as string,
    tier: (creator.subscription_tier as SubscriptionTier) ?? "free",
  };
}

/**
 * Check whether the creator can add another connected platform.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, current, limit, tier }`.
 */
export async function checkPlatformLimit(creatorId: string, tier: SubscriptionTier) {
  const supabase = await createServerClient();

  const { count } = await supabase
    .from("connected_platforms")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .neq("status", "disconnected");

  const current = count ?? 0;
  const limit = TIER_LIMITS[tier].platforms;

  if (current < limit) {
    return { allowed: true as const, current, limit, tier };
  }
  return { allowed: false as const, current, limit, tier };
}

/**
 * Check whether the creator can create another repurpose job this calendar month.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, current, limit, tier }`.
 */
export async function checkRepurposeMonthlyLimit(
  creatorId: string,
  tier: SubscriptionTier
) {
  const supabase = await createServerClient();

  // First day of the current UTC month
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const { count } = await supabase
    .from("repurpose_jobs")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .gte("created_at", monthStart);

  const current = count ?? 0;
  const limit = TIER_LIMITS[tier].repurposeJobsPerMonth;

  if (current < limit) {
    return { allowed: true as const, current, limit, tier };
  }
  return { allowed: false as const, current, limit, tier };
}
