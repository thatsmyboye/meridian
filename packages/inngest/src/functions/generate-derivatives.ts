import Anthropic from "@anthropic-ai/sdk";
import { inngest } from "../client";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { DERIVATIVE_FORMATS, type DerivativeFormat } from "../lib/derivative-prompts";
import {
  fetchTopCreatorInsights,
  buildInsightContext,
} from "../lib/fetchCreatorInsights";
import { trackAiUsage, parseRateLimitHeaders } from "../lib/trackAiUsage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Derivative {
  format: string;
  content: string;
  platform: string;
  char_count: number;
  status: "pending" | "approved" | "rejected";
  previous_drafts: string[];
  created_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateSingleDerivative(
  transcript: string,
  contentTitle: string,
  format: DerivativeFormat,
  insightContext: string,
  creatorId?: string,
): Promise<{ content: string; char_count: number }> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const systemPrompt = insightContext
    ? `${format.systemPrompt}${insightContext}`
    : format.systemPrompt;

  const { data: message, response } = await anthropic.messages
    .create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is the transcript from "${contentTitle}":\n\n${transcript}`,
        },
      ],
    })
    .withResponse();

  // Track usage — non-blocking, errors are swallowed inside trackAiUsage
  void trackAiUsage({
    message,
    functionName: "generate-derivatives",
    creatorId,
    rateLimits: parseRateLimitHeaders(response),
    metadata: { format: format.platform },
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const content = textBlock?.text ?? "";

  return {
    content,
    char_count: content.length,
  };
}

// ─── Inngest function: generate all derivatives for a job ────────────────────

/**
 * Generates derivatives for all selected formats of a repurpose job.
 *
 * Triggered by: repurpose/transcript.extracted
 *
 * Steps:
 *  1. load-job – Load the repurpose job and verify transcript exists
 *  2. fetch-creator-insights – Load top 2 pattern insights for the creator
 *  3. generate-{format} – One step per selected format, calling Claude API
 *  4. save-derivatives – Persist all generated derivatives to the job
 */
export const generateDerivatives = inngest.createFunction(
  {
    id: "generate-derivatives",
    name: "Generate Transcript Derivatives",
    retries: 3,
    concurrency: [{ limit: 5 }],
  },
  { event: "repurpose/transcript.extracted" },
  async ({ event, step }) => {
    const { repurpose_job_id, creator_id, transcript_length } = event.data;

    // Skip if no transcript was extracted
    if (transcript_length === 0) {
      await step.run("mark-failed-no-transcript", async () => {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("repurpose_jobs")
          .update({
            status: "failed",
            error_message: "No transcript available for derivative generation.",
          })
          .eq("id", repurpose_job_id);
      });
      return { repurpose_job_id, status: "failed", reason: "no_transcript" };
    }

    // ── Step 1: Load job data ────────────────────────────────────────────────
    const jobData = await step.run("load-job", async () => {
      const supabase = getSupabaseAdmin();

      const { data: job, error: jobErr } = await supabase
        .from("repurpose_jobs")
        .select("id, source_item_id, source_transcript, selected_formats, status")
        .eq("id", repurpose_job_id)
        .single();

      if (jobErr || !job) {
        throw new Error(`Job ${repurpose_job_id} not found: ${jobErr?.message}`);
      }

      const { data: contentItem } = await supabase
        .from("content_items")
        .select("title")
        .eq("id", job.source_item_id)
        .single();

      // Mark as processing
      await supabase
        .from("repurpose_jobs")
        .update({ status: "processing" })
        .eq("id", repurpose_job_id);

      return {
        transcript: job.source_transcript ?? "",
        selectedFormats: (job.selected_formats ?? []) as string[],
        contentTitle: contentItem?.title ?? "Untitled",
      };
    });

    const { transcript, selectedFormats, contentTitle } = jobData;

    // ── Step 2: Fetch creator pattern insights ───────────────────────────────
    const insightContext = await step.run("fetch-creator-insights", async () => {
      const insights = await fetchTopCreatorInsights(creator_id);
      return buildInsightContext(insights);
    });

    // Determine which formats to generate
    const formatsToGenerate = selectedFormats.length > 0
      ? selectedFormats.filter((f) => DERIVATIVE_FORMATS[f])
      : Object.keys(DERIVATIVE_FORMATS);

    // ── Step 3: Generate each derivative ─────────────────────────────────────
    const derivatives: Derivative[] = [];
    const now = new Date().toISOString();

    for (const formatKey of formatsToGenerate) {
      const format = DERIVATIVE_FORMATS[formatKey]!;

      const result = await step.run(`generate-${formatKey}`, async () => {
        return generateSingleDerivative(transcript, contentTitle, format, insightContext, creator_id);
      });

      derivatives.push({
        format: formatKey,
        content: result.content,
        platform: format.platform,
        char_count: result.char_count,
        status: "pending",
        previous_drafts: [],
        created_at: now,
        updated_at: now,
      });
    }

    // ── Step 4: Save derivatives and mark job as ready for review ─────────
    await step.run("save-derivatives", async () => {
      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from("repurpose_jobs")
        .update({
          derivatives: JSON.parse(JSON.stringify(derivatives)),
          status: "review",
        })
        .eq("id", repurpose_job_id);

      if (error) {
        throw new Error(
          `Failed to save derivatives for job ${repurpose_job_id}: ${error.message}`
        );
      }
    });

    return {
      repurpose_job_id,
      creator_id,
      status: "review",
      formats_generated: formatsToGenerate.length,
    };
  }
);

// ─── Inngest function: regenerate a single derivative ────────────────────────

/**
 * Regenerates a single format derivative for a repurpose job.
 *
 * Triggered by: repurpose/derivative.regenerate
 */
export const regenerateDerivative = inngest.createFunction(
  {
    id: "regenerate-derivative",
    name: "Regenerate Single Derivative",
    retries: 3,
  },
  { event: "repurpose/derivative.regenerate" },
  async ({ event, step }) => {
    const { repurpose_job_id, format_key } = event.data;

    const jobData = await step.run("load-job", async () => {
      const supabase = getSupabaseAdmin();

      const { data: job, error } = await supabase
        .from("repurpose_jobs")
        .select("id, creator_id, source_item_id, source_transcript, derivatives")
        .eq("id", repurpose_job_id)
        .single();

      if (error || !job) {
        throw new Error(`Job ${repurpose_job_id} not found: ${error?.message}`);
      }

      const { data: contentItem } = await supabase
        .from("content_items")
        .select("title")
        .eq("id", job.source_item_id)
        .single();

      return {
        creatorId: job.creator_id as string,
        transcript: job.source_transcript ?? "",
        derivatives: (job.derivatives ?? []) as Derivative[],
        contentTitle: contentItem?.title ?? "Untitled",
      };
    });

    const format = DERIVATIVE_FORMATS[format_key];
    if (!format) {
      throw new Error(`Unknown format: ${format_key}`);
    }

    // ── Fetch creator pattern insights ───────────────────────────────────────
    const insightContext = await step.run("fetch-creator-insights", async () => {
      const insights = await fetchTopCreatorInsights(jobData.creatorId);
      return buildInsightContext(insights);
    });

    const result = await step.run("regenerate", async () => {
      return generateSingleDerivative(
        jobData.transcript,
        jobData.contentTitle,
        format,
        insightContext,
        jobData.creatorId,
      );
    });

    await step.run("update-derivatives", async () => {
      const supabase = getSupabaseAdmin();
      const now = new Date().toISOString();

      const updatedDerivatives = jobData.derivatives.map((d) => {
        if (d.format === format_key) {
          return {
            ...d,
            previous_drafts: [...d.previous_drafts, d.content],
            content: result.content,
            char_count: result.char_count,
            status: "pending" as const,
            updated_at: now,
          };
        }
        return d;
      });

      const { error } = await supabase
        .from("repurpose_jobs")
        .update({ derivatives: JSON.parse(JSON.stringify(updatedDerivatives)) })
        .eq("id", repurpose_job_id);

      if (error) {
        throw new Error(`Failed to update derivatives: ${error.message}`);
      }
    });

    return { repurpose_job_id, format_key, status: "regenerated" };
  }
);
