-- =============================================================
-- Meridian – Add 'patreon' to platform_name enum
-- Migration: 20260402000002_add_patreon_platform.sql
--
-- Root cause of save_failed error:
--   The platform_name enum did not include 'patreon', so any
--   INSERT/UPSERT into connected_platforms with platform='patreon'
--   was rejected by PostgreSQL, producing the save_failed redirect.
-- =============================================================

alter type platform_name add value if not exists 'patreon';
