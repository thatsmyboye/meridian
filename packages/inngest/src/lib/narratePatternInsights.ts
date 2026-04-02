import Anthropic from "@anthropic-ai/sdk";
import { trackAiUsage, parseRateLimitHeaders } from "./trackAiUsage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLabel = "Strong" | "Moderate" | "Emerging";

export interface PatternNarration {
  narrative: string;
  confidence_label: ConfidenceLabel;
}

/** Input shape passed from the pattern computation step. */
export interface PatternInsightInput {
  insight_type: string;
  summary: string;
  evidence_json: Record<string, unknown>;
  confidence: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a numeric confidence score (0–1) to a human-readable label.
 *
 *  Strong   ≥ 0.700  (21+ samples out of the 30-sample target)
 *  Moderate ≥ 0.400  (12+ samples)
 *  Emerging <  0.400  (fewer than 12 samples)
 */
export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 0.7) return "Strong";
  if (score >= 0.4) return "Moderate";
  return "Emerging";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a creator analytics coach. Given statistical patterns, write 2–3 sentence insight narratives in American English.

Always respond with a single JSON object — no markdown, no prose outside it — in this exact shape:
{"narrative":"<2-3 sentence actionable insight>","confidence_label":"<Strong|Moderate|Emerging>"}`;

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Calls the Claude API to narrate each computed pattern insight as plain
 * English. Returns a `Record<insight_type, PatternNarration>` suitable for
 * JSON serialisation in an Inngest step result.
 *
 * Each API call uses claude-opus-4-6 with a system prompt that constrains the
 * response to a strict JSON object containing:
 *  • narrative        — 2–3 sentence plain-English insight for the creator
 *  • confidence_label — "Strong" | "Moderate" | "Emerging"
 *
 * Failures for individual insights are caught and logged; the returned record
 * simply omits that key, so callers can fall back to the statistical summary.
 */
export async function narratePatternInsights(
  insights: readonly PatternInsightInput[]
): Promise<Record<string, PatternNarration>> {
  const client = new Anthropic();
  const results: Record<string, PatternNarration> = {};

  for (const insight of insights) {
    const label = confidenceLabel(insight.confidence);

    const userContent = JSON.stringify({
      insight_type: insight.insight_type,
      statistical_summary: insight.summary,
      evidence: insight.evidence_json,
      confidence_score: insight.confidence,
      confidence_label: label,
    });

    try {
      const { data: response, response: httpResponse } = await client.messages
        .create({
          model: "claude-opus-4-6",
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        })
        .withResponse();

      // Track token usage — non-blocking, errors swallowed inside trackAiUsage
      void trackAiUsage({
        message: response,
        functionName: "narrate-pattern-insights",
        rateLimits: parseRateLimitHeaders(httpResponse),
        metadata: { insight_type: insight.insight_type },
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude response contained no text block");
      }

      // Extract JSON from the response (strip any accidental surrounding whitespace).
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(
          `Claude did not return valid JSON for insight "${insight.insight_type}": ${textBlock.text}`
        );
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        narrative: string;
        confidence_label: ConfidenceLabel;
      };

      results[insight.insight_type] = {
        narrative: parsed.narrative,
        // Always use the deterministic label computed from sample count;
        // the model's label is advisory only.
        confidence_label: label,
      };
    } catch (err) {
      // Non-fatal: the statistical summary in `summary` serves as a fallback.
      console.error(
        `[narratePatternInsights] Failed to narrate "${insight.insight_type}":`,
        err
      );
    }
  }

  return results;
}
