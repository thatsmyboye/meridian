import Stripe from "stripe";

/**
 * Lazily-initialized Stripe client.
 *
 * Exported as a Proxy so that `new Stripe(...)` is deferred until the first
 * property access at request time. This prevents the constructor from running
 * during Next.js build-time static page collection, when STRIPE_SECRET_KEY is
 * not available in the environment.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY   – sk_live_… or sk_test_…
 */
let _stripe: Stripe | undefined;

function getInstance(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getInstance() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Maps a Stripe Price ID to the corresponding subscription tier.
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
