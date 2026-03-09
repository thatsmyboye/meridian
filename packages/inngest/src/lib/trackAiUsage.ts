import type { Message } from "@anthropic-ai/sdk/resources/messages.js";
import { PostHog } from "posthog-node";
import { getSupabaseAdmin } from "./supabaseAdmin";

// ─── Cost table ──────────────────────────────────────────────────────────────
// USD per token (input / output) for each model.
// Update when Anthropic changes pricing.

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": {
    input: 3 / 1_000_000,   // $3.00 / MTok
    output: 15 / 1_000_000, // $15.00 / MTok
  },
  "claude-opus-4-6": {
    input: 15 / 1_000_000,  // $15.00 / MTok
    output: 75 / 1_000_000, // $75.00 / MTok
  },
};

// ─── Rate-limit header shape ──────────────────────────────────────────────────

export interface RateLimitInfo {
  remaining_requests: number | null;
  limit_requests: number | null;
  remaining_tokens: number | null;
  limit_tokens: number | null;
}

// Threshold at which we emit a console warning (10 % of limit remaining)
const RATE_LIMIT_WARN_THRESHOLD = 0.1;

// ─── Main export ─────────────────────────────────────────────────────────────

export interface TrackAiUsageOptions {
  /** The full Anthropic Message response object. */
  message: Message;
  /** Inngest function or code path that made the call, e.g. "generate-derivatives". */
  functionName: string;
  /** The Meridian creator_id associated with this call (if known). */
  creatorId?: string;
  /** Raw rate-limit values parsed from the HTTP response headers. */
  rateLimits?: RateLimitInfo;
  /** Arbitrary extra context to store in the metadata JSONB column. */
  metadata?: Record<string, unknown>;
}

/**
 * Persists an Anthropic API call's token usage to:
 *  1. `ai_usage_logs` (Supabase) — authoritative long-term store
 *  2. PostHog — real-time dashboard & alerting
 *
 * Fires rate-limit console warnings when remaining capacity drops below
 * RATE_LIMIT_WARN_THRESHOLD (10 %) for either requests or tokens.
 *
 * Never throws — failures are logged but do not propagate to callers.
 */
export async function trackAiUsage({
  message,
  functionName,
  creatorId,
  rateLimits,
  metadata = {},
}: TrackAiUsageOptions): Promise<void> {
  const { model, usage } = message;
  const { input_tokens, output_tokens } = usage;

  // ── Cost estimate ─────────────────────────────────────────────────────────
  const costs = MODEL_COSTS[model];
  const cost_usd = costs
    ? input_tokens * costs.input + output_tokens * costs.output
    : 0;

  // ── Rate-limit proximity warnings ─────────────────────────────────────────
  if (rateLimits) {
    const { remaining_tokens, limit_tokens, remaining_requests, limit_requests } =
      rateLimits;

    if (
      remaining_tokens != null &&
      limit_tokens != null &&
      limit_tokens > 0 &&
      remaining_tokens / limit_tokens < RATE_LIMIT_WARN_THRESHOLD
    ) {
      console.warn(
        `[trackAiUsage] Rate limit warning — tokens: ${remaining_tokens}/${limit_tokens} remaining (${model})`
      );
    }

    if (
      remaining_requests != null &&
      limit_requests != null &&
      limit_requests > 0 &&
      remaining_requests / limit_requests < RATE_LIMIT_WARN_THRESHOLD
    ) {
      console.warn(
        `[trackAiUsage] Rate limit warning — requests: ${remaining_requests}/${limit_requests} remaining (${model})`
      );
    }
  }

  const logMetadata = {
    ...metadata,
    ...(rateLimits ? { rate_limits: rateLimits } : {}),
  };

  // ── 1. Persist to Supabase ────────────────────────────────────────────────
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("ai_usage_logs").insert({
      creator_id: creatorId ?? null,
      function_name: functionName,
      model,
      input_tokens,
      output_tokens,
      cost_usd,
      metadata: logMetadata,
    });

    if (error) {
      console.error("[trackAiUsage] Supabase insert failed:", error.message);
    }
  } catch (err) {
    console.error("[trackAiUsage] Supabase insert threw:", err);
  }

  // ── 2. Send to PostHog ────────────────────────────────────────────────────
  const posthogKey = process.env.POSTHOG_KEY;
  if (!posthogKey) return; // PostHog is optional — skip silently if not configured

  try {
    const ph = new PostHog(posthogKey, {
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    });

    ph.capture({
      distinctId: creatorId ?? "system",
      event: "ai_api_call",
      properties: {
        model,
        function_name: functionName,
        input_tokens,
        output_tokens,
        total_tokens: input_tokens + output_tokens,
        cost_usd,
        ...(rateLimits ? { rate_limits: rateLimits } : {}),
        ...metadata,
      },
    });

    await ph.flush();
  } catch (err) {
    console.error("[trackAiUsage] PostHog capture failed:", err);
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parses Anthropic rate-limit headers from a raw `Response` object.
 * Returns null values for any header that is absent or unparseable.
 */
export function parseRateLimitHeaders(response: Response): RateLimitInfo {
  const num = (header: string) => {
    const val = response.headers.get(header);
    if (!val) return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  };

  return {
    remaining_requests: num("x-ratelimit-remaining-requests"),
    limit_requests: num("x-ratelimit-limit-requests"),
    remaining_tokens: num("x-ratelimit-remaining-tokens"),
    limit_tokens: num("x-ratelimit-limit-tokens"),
  };
}
