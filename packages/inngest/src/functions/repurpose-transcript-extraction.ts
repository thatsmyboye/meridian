import OpenAI from "openai";
import { inngest } from "../client";
import { ensureValidYouTubeToken } from "../lib/refreshYouTubeToken";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

// ─── YouTube API types ────────────────────────────────────────────────────────

interface CaptionsListResponse {
  items?: Array<{
    id: string;
    snippet: {
      language: string;
      /** "standard" | "asr" | "forced" */
      trackKind: string;
      isDraft: boolean;
    };
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips WebVTT timing lines, headers, and inline HTML tags, returning
 * a single block of plain-text transcript suitable for LLM consumption.
 */
function stripVttToText(vtt: string): string {
  return vtt
    .split("\n")
    .filter((line) => {
      if (line.startsWith("WEBVTT")) return false;
      if (line.startsWith("NOTE")) return false;
      // Timestamp lines: "00:00:00.000 --> 00:00:01.000"
      if (/^\d{2}:\d{2}/.test(line)) return false;
      // Pure cue identifiers (numbers)
      if (/^\d+$/.test(line.trim())) return false;
      return true;
    })
    .map((line) =>
      // Strip inline tags like <c>, <00:00:01.000>, <b>, etc.
      line.replace(/<[^>]+>/g, "")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Picks the best caption track from the list returned by the YouTube
 * captions.list API.
 *
 * Priority:
 *   1. Non-draft English standard captions
 *   2. Non-draft English ASR (auto-generated) captions
 *   3. Any non-draft caption track
 *   4. First track in the list (last resort)
 *
 * Returns the caption track ID or null when the list is empty.
 */
function pickCaptionTrackId(
  items: NonNullable<CaptionsListResponse["items"]>
): string | null {
  if (items.length === 0) return null;

  const english = items.find(
    (t) =>
      !t.snippet.isDraft &&
      t.snippet.language.startsWith("en") &&
      t.snippet.trackKind !== "forced"
  );
  if (english) return english.id;

  const anyNonDraft = items.find((t) => !t.snippet.isDraft);
  if (anyNonDraft) return anyNonDraft.id;

  return items[0].id;
}

// ─── Inngest function ─────────────────────────────────────────────────────────

/**
 * Extracts a text transcript for the source content item of a repurpose job
 * and stores it in repurpose_jobs.source_transcript.
 *
 * Triggered by: repurpose/job.created
 *
 * Steps:
 *  1. load-job           – Load the repurpose job, source content_item, and
 *                          connected_platform credentials.
 *  2. fetch-yt-captions  – (YouTube only) Download caption track via the
 *                          YouTube Data API captions.list + captions.download.
 *  3. whisper-fallback   – If captions are unavailable, fetch the audio from
 *                          media_urls[0] and transcribe via OpenAI Whisper.
 *  4. store-transcript   – Persist the transcript (or empty string) to
 *                          repurpose_jobs.source_transcript.
 */
export const extractRepurposeTranscript = inngest.createFunction(
  {
    id: "extract-repurpose-transcript",
    name: "Extract Repurpose Transcript",
    retries: 2,
  },
  { event: "repurpose/job.created" },
  async ({ event, step }) => {
    const { repurpose_job_id, creator_id } = event.data;

    // ── Step 1: Load job + content item + platform credentials ───────────────
    const { contentItem, platformRow } = await step.run("load-job", async () => {
      const supabase = getSupabaseAdmin();

      const { data: job, error: jobErr } = await supabase
        .from("repurpose_jobs")
        .select("id, source_item_id")
        .eq("id", repurpose_job_id)
        .single();

      if (jobErr || !job) {
        throw new Error(
          `repurpose_job ${repurpose_job_id} not found: ${jobErr?.message}`
        );
      }

      const { data: contentItem, error: contentErr } = await supabase
        .from("content_items")
        .select("id, platform, external_id, media_urls, platform_id")
        .eq("id", job.source_item_id)
        .single();

      if (contentErr || !contentItem) {
        throw new Error(
          `content_item ${job.source_item_id} not found: ${contentErr?.message}`
        );
      }

      // Load platform credentials only for YouTube (needed to call captions API)
      let platformRow: {
        id: string;
        access_token_enc: string;
        refresh_token_enc: string | null;
        token_expires_at: string | null;
      } | null = null;

      if (contentItem.platform === "youtube" && contentItem.platform_id) {
        const { data: platform } = await supabase
          .from("connected_platforms")
          .select("id, access_token_enc, refresh_token_enc, token_expires_at")
          .eq("id", contentItem.platform_id)
          .single();
        platformRow = platform;
      }

      return { contentItem, platformRow };
    });

    // ── Step 2 (YouTube): Try YouTube Data API captions ───────────────────────
    let transcript: string | null = null;

    if (contentItem.platform === "youtube" && contentItem.external_id) {
      transcript = await step.run("fetch-yt-captions", async () => {
        if (!platformRow) {
          console.info(
            `[transcript] No connected platform row for content_item ${contentItem.id}; skipping captions.`
          );
          return null;
        }

        const supabase = getSupabaseAdmin();
        const tokenResult = await ensureValidYouTubeToken(platformRow, supabase);
        if (!tokenResult.ok) {
          console.warn(`[transcript] YouTube token invalid: ${tokenResult.reason}`);
          return null;
        }

        const { accessToken } = tokenResult;

        // 2a. List available caption tracks for the video
        const listUrl = new URL(
          "https://www.googleapis.com/youtube/v3/captions"
        );
        listUrl.searchParams.set("part", "snippet");
        listUrl.searchParams.set("videoId", contentItem.external_id as string);

        const listRes = await fetch(listUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listRes.ok) {
          console.warn(
            `[transcript] captions.list failed (${listRes.status}): ${await listRes.text()}`
          );
          return null;
        }

        const listData: CaptionsListResponse = await listRes.json();
        const captionId = pickCaptionTrackId(listData.items ?? []);

        if (!captionId) {
          console.info(
            `[transcript] No caption tracks found for video ${contentItem.external_id}`
          );
          return null;
        }

        // 2b. Download the selected caption track as WebVTT
        const downloadUrl = new URL(
          `https://www.googleapis.com/youtube/v3/captions/${captionId}`
        );
        downloadUrl.searchParams.set("tfmt", "vtt");

        const downloadRes = await fetch(downloadUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!downloadRes.ok) {
          console.warn(
            `[transcript] captions.download failed (${downloadRes.status}): ${await downloadRes.text()}`
          );
          return null;
        }

        const vttText = await downloadRes.text();
        const plainText = stripVttToText(vttText);

        console.info(
          `[transcript] Fetched captions via YouTube API for video ${contentItem.external_id} ` +
            `(${plainText.length} chars)`
        );

        return plainText;
      });
    }

    // ── Step 3: Whisper fallback if no captions were obtained ─────────────────
    if (!transcript) {
      transcript = await step.run("whisper-fallback", async () => {
        const mediaUrls: string[] = contentItem.media_urls ?? [];
        const audioUrl = mediaUrls[0] ?? null;

        if (!audioUrl) {
          console.info(
            `[transcript] No media_url available for Whisper fallback on content_item ${contentItem.id}`
          );
          return null;
        }

        // Fetch the audio file and pass it to the Whisper API as a File object
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) {
          console.warn(
            `[transcript] Audio fetch failed (${audioRes.status}) for ${audioUrl}`
          );
          return null;
        }

        const audioBuffer = await audioRes.arrayBuffer();
        // Infer a reasonable filename/MIME from the URL; Whisper is lenient
        const ext = audioUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "mp4";
        const audioFile = new File([audioBuffer], `audio.${ext}`, {
          type: ext === "mp3" ? "audio/mpeg" : "audio/mp4",
        });

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const result = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: audioFile,
        });

        console.info(
          `[transcript] Whisper transcription complete for content_item ${contentItem.id} ` +
            `(${result.text.length} chars)`
        );

        return result.text;
      });
    }

    // ── Step 4: Persist the transcript ────────────────────────────────────────
    await step.run("store-transcript", async () => {
      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from("repurpose_jobs")
        .update({ source_transcript: transcript ?? "" })
        .eq("id", repurpose_job_id);

      if (error) {
        throw new Error(
          `[transcript] Failed to store transcript for job ${repurpose_job_id}: ${error.message}`
        );
      }
    });

    // ── Step 5: Emit transcript.extracted event for downstream steps ──────────
    const transcriptLength = transcript?.length ?? 0;

    await step.sendEvent("emit-transcript-extracted", {
      name: "repurpose/transcript.extracted",
      data: {
        creator_id,
        repurpose_job_id,
        transcript_length: transcriptLength,
      },
    });

    return {
      repurpose_job_id,
      creator_id,
      platform: contentItem.platform,
      transcriptLength,
    };
  }
);
