-- =============================================================
-- Meridian – Align connected_platforms with canonical TypeScript types
-- Migration: 20260225000000_align_connected_platforms.sql
--
-- Changes:
--   1. Create connection_status enum ('active', 'reauth_required', 'disconnected')
--   2. Rename handle → platform_username (consistent with ConnectedPlatform type)
--   3. Add platform_user_id (e.g. YouTube channel ID, Instagram user ID)
--   4. Add status column using the new enum, defaulting to 'active'
-- =============================================================

-- ---------------------------------------------------------------------------
-- 1. Enum: connection_status
-- ---------------------------------------------------------------------------
create type connection_status as enum (
  'active',
  'reauth_required',
  'disconnected'
);

-- ---------------------------------------------------------------------------
-- 2. Rename handle → platform_username
-- ---------------------------------------------------------------------------
alter table connected_platforms
  rename column handle to platform_username;

-- ---------------------------------------------------------------------------
-- 3. Add platform_user_id
--    Stores the platform-native user/channel identifier (e.g. YouTube UCxxxxx)
-- ---------------------------------------------------------------------------
alter table connected_platforms
  add column platform_user_id text;

-- ---------------------------------------------------------------------------
-- 4. Add status column
-- ---------------------------------------------------------------------------
alter table connected_platforms
  add column status connection_status not null default 'active';
