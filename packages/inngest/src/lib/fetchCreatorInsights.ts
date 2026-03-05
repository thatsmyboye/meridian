import { getSupabaseAdmin } from "./supabaseAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatorInsightContext {
  insight_type: string;
  narrative: string | null;
  summary: string;
  confidence_label: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches the top N non-dismissed pattern insights for a creator,
 * ordered by confidence (desc) then recency (desc).
 *
 * Returns an empty array on any error so callers can degrade gracefully —
 * a missing insight should never block derivative generation.
 */
export async function fetchTopCreatorInsights(
  creatorId: string,
  limit = 2,
): Promise<CreatorInsightContext[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("pattern_insights")
    .select("insight_type, narrative, summary, confidence_label")
    .eq("creator_id", creatorId)
    .eq("is_dismissed", false)
    .order("confidence", { ascending: false })
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as CreatorInsightContext[];
}

/**
 * Builds the pattern-aware context block to inject into a system prompt.
 *
 * Uses the Claude-narrated `narrative` when available, falling back to the
 * raw statistical `summary`. Returns an empty string when there are no
 * insights so callers can safely concatenate without adding blank lines.
 */
export function buildInsightContext(insights: CreatorInsightContext[]): string {
  if (insights.length === 0) return "";

  const bullets = insights
    .map((i) => `- ${i.narrative ?? i.summary}`)
    .join("\n");

  return `\nThis creator's data shows their audience responds best to:\n${bullets}\n`;
}
