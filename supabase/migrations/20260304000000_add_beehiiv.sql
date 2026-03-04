-- =============================================================
-- Meridian – Add Beehiiv newsletter platform support
-- Migration: 20260304000000_add_beehiiv.sql
--
-- Changes:
--   1. Add 'beehiiv' to the platform_name enum so newsletter
--      content can be stored alongside other platform content.
--   2. Add newsletter-specific metrics columns to
--      performance_snapshots: open_rate, click_rate, clicks.
--      These are NULL for non-newsletter platforms.
-- =============================================================

-- ---------------------------------------------------------------------------
-- 1. Add 'beehiiv' to the platform_name enum
-- ---------------------------------------------------------------------------
alter type platform_name add value if not exists 'beehiiv';

-- ---------------------------------------------------------------------------
-- 2. Add newsletter metrics to performance_snapshots
--
--   clicks     – unique recipients who clicked a link in the email
--   open_rate  – percentage of recipients who opened (0–100)
--   click_rate – percentage of recipients who clicked (0–100)
-- ---------------------------------------------------------------------------
alter table performance_snapshots
  add column if not exists clicks    bigint,
  add column if not exists open_rate numeric(6, 3),
  add column if not exists click_rate numeric(6, 3);

comment on column performance_snapshots.clicks is
  'Unique recipients who clicked a link (newsletter / email platforms).';

comment on column performance_snapshots.open_rate is
  'Email open rate as a percentage (0–100). Populated for newsletter platforms.';

comment on column performance_snapshots.click_rate is
  'Email click rate as a percentage (0–100). Populated for newsletter platforms.';
