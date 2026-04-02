-- =============================================================
-- Meridian – Enable Supabase Realtime for connected_platforms
-- Migration: 20260402000001_enable_realtime_connected_platforms.sql
--
-- Root cause of last_synced_at not updating live on /connect:
--   connected_platforms was never added to the supabase_realtime
--   publication, so postgres_changes subscriptions in the browser
--   received no events when Inngest stamped last_synced_at.
--
-- Changes:
--   1. Set REPLICA IDENTITY FULL so UPDATE payloads include every
--      column (required for row-filter subscriptions to work and
--      for the browser to receive the full updated row).
--   2. Add table to the supabase_realtime publication.
-- =============================================================

-- 1. Full replica identity — ensures the complete row is included in
--    the WAL record for every UPDATE, which Supabase Realtime needs
--    to broadcast the payload with all columns to subscribed clients.
alter table connected_platforms replica identity full;

-- 2. Publish changes so browser clients receive INSERT/UPDATE events.
alter publication supabase_realtime add table connected_platforms;
