-- =============================================================
-- Meridian – Add 'substack' to platform_name enum
-- Migration: 20260323000000_add_substack_platform.sql
--
-- Root cause of save_failed error:
--   The platform_name enum did not include 'substack', so any
--   INSERT/UPSERT into connected_platforms with platform='substack'
--   was rejected by PostgreSQL, producing the save_failed redirect.
-- =============================================================

alter type platform_name add value if not exists 'substack';
