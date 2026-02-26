-- =============================================================
-- Meridian – Add day_mark to performance_snapshots
-- Migration: 20260226000000_add_snapshot_day_mark.sql
--
-- Changes:
--   1. Add day_mark column (smallint) to performance_snapshots.
--      Values: 1, 7, or 30 (days since publication at snapshot time).
--      NULL for ad-hoc snapshots that are not tied to a lifecycle mark.
--   2. Add a partial unique index so each content item can have at most
--      one snapshot per day mark (prevents cron re-runs from duplicating).
-- =============================================================

-- ---------------------------------------------------------------------------
-- 1. Add day_mark column
-- ---------------------------------------------------------------------------
alter table performance_snapshots
  add column day_mark smallint;

comment on column performance_snapshots.day_mark is
  'Lifecycle snapshot mark in days after publication (1, 7, or 30). '
  'NULL for ad-hoc or manually triggered snapshots.';

-- ---------------------------------------------------------------------------
-- 2. Partial unique index: one snapshot per (content_item, day_mark)
--    NULL day_marks are excluded so ad-hoc snapshots are never blocked.
-- ---------------------------------------------------------------------------
create unique index idx_performance_snapshots_item_day_mark
  on performance_snapshots (content_item_id, day_mark)
  where day_mark is not null;
