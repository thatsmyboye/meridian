-- =============================================================
-- Meridian – Add last_sync_count to connected_platforms
-- Migration: 20260325000000_add_last_sync_count.sql
--
-- Tracks the number of content items upserted during the most
-- recent successful sync so the UI can display sync success detail
-- alongside the last_synced_at timestamp.
-- =============================================================

alter table connected_platforms
  add column if not exists last_sync_count integer;

comment on column connected_platforms.last_sync_count is
  'Number of content items upserted during the most recent successful sync.';
