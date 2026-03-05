-- ===========================================================================
-- Add Claude-generated narrative fields to pattern_insights
--
-- narrative        — 2–3 sentence plain-English insight written by Claude.
--                   NULL when the API call failed; fall back to `summary`.
-- confidence_label — Human-readable tier derived from confidence score:
--                   'Strong' (≥0.700), 'Moderate' (≥0.400), 'Emerging' (<0.400)
-- ===========================================================================

alter table pattern_insights
  add column if not exists narrative        text,
  add column if not exists confidence_label text
    check (confidence_label in ('Strong', 'Moderate', 'Emerging'));
