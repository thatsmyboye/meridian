import Stripe from "stripe";

/**
 * Singleton Stripe client.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          – Stripe secret key (sk_live_… or sk_test_…)
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * Maps a Stripe Price ID to the corresponding subscription tier.
 * Both env vars must be set to the Price IDs created in the Stripe dashboard.
 *
 * Required env vars:
 *   STRIPE_CREATOR_PRICE_ID   – Price ID for Meridian Creator ($19/mo)
 *   STRIPE_PRO_PRICE_ID       – Price ID for Meridian Pro ($49/mo)
 */
export function tierFromPriceId(
  priceId: string
): "creator" | "pro" | null {
  if (priceId === process.env.STRIPE_CREATOR_PRICE_ID) return "creator";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return null;
}
