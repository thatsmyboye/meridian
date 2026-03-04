-- =============================================================
-- Meridian – Add last_synced_at to connected_platforms
-- Migration: 20260304000001_add_last_synced_at.sql
--
-- Adds a last_synced_at timestamp to connected_platforms so the
-- Settings > Connections page can show when each platform was last
-- successfully synced.
-- =============================================================

alter table connected_platforms
  add column if not exists last_synced_at timestamptz;

comment on column connected_platforms.last_synced_at is
  'Timestamp of the most recent successful content sync for this platform connection.';
