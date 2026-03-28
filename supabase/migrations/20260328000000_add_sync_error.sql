-- =============================================================
-- Meridian – Add sync_error to connected_platforms
-- Migration: 20260328000000_add_sync_error.sql
--
-- Stores the error message from the most recent failed sync so
-- the UI can surface a clear failure state instead of leaving
-- the spinner running forever.
-- Cleared to null on every successful sync.
-- =============================================================

alter table connected_platforms
  add column if not exists sync_error text;

comment on column connected_platforms.sync_error is
  'Error message from the most recent failed sync. Null when the last sync succeeded or has never been attempted.';
