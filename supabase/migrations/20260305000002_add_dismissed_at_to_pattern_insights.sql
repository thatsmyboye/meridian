-- ===========================================================================
-- Add dismissed_at timestamp to pattern_insights
--
-- dismissed_at — Timestamp when the insight was dismissed by the creator.
--               NULL when not dismissed.
-- ===========================================================================

alter table pattern_insights
  add column if not exists dismissed_at timestamptz;

-- Create index for filtering active (non-dismissed) insights
create index if not exists idx_pattern_insights_dismissed_at on pattern_insights (dismissed_at);
