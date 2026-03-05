-- =============================================================
-- Meridian – Add engagement_rate and watch_time_minutes to performance_snapshots
-- Migration: 20260304000004_add_engagement_stats_to_snapshots.sql
--
-- These computed columns are populated by the analytics snapshot
-- functions (YouTube, Instagram, Beehiiv) and consumed by the
-- weekly pattern intelligence cron.
--
-- engagement_rate  – ratio of interactions to views, clamped [0, 1].
--                    Calculated per-platform by the normaliseMetrics layer.
-- watch_time_minutes – cumulative watch time in minutes.
--                    Populated only for YouTube; NULL for Instagram/Beehiiv.
-- =============================================================

alter table performance_snapshots
  add column if not exists engagement_rate   numeric(6, 5),
  add column if not exists watch_time_minutes numeric(12, 2);

comment on column performance_snapshots.engagement_rate is
  'Ratio of interactions to views, clamped to [0, 1]. '
  'Computed per-platform by the normaliseMetrics layer.';

comment on column performance_snapshots.watch_time_minutes is
  'Cumulative watch time in minutes (YouTube only). NULL for platforms '
  'that do not expose watch-time data (Instagram, Beehiiv).';
