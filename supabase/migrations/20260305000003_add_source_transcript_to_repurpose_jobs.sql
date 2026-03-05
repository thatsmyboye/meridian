-- =============================================================
-- Meridian – Add source_transcript to repurpose_jobs
-- Migration: 20260305000003_add_source_transcript_to_repurpose_jobs.sql
--
-- Stores the raw transcript text (fetched captions or Whisper output)
-- for the source content item so Claude has text to work from
-- rather than guessing from metadata alone.
-- =============================================================

alter table repurpose_jobs
  add column if not exists source_transcript text;

comment on column repurpose_jobs.source_transcript is
  'Raw transcript text for the source content item. '
  'Populated by the transcript-extraction Inngest job via YouTube captions API '
  'or OpenAI Whisper fallback. NULL until extraction completes.';
