-- =============================================================
-- Meridian – Fix reconnect blocked by INSERT tier-limit policy
-- Migration: 20260320000001_fix_reconnect_insert_policy.sql
--
-- Root cause:
--   PostgreSQL evaluates an INSERT policy's WITH CHECK expression
--   even when the INSERT ... ON CONFLICT DO UPDATE path is taken
--   (i.e. an upsert that resolves to an UPDATE). The current INSERT
--   policy on connected_platforms checks:
--
--     get_active_platform_count(creator_id) < get_platform_limit(tier)
--
--   When a user reconnects a platform that already exists, their
--   active platform count equals the limit (e.g. 1 for free tier).
--   The check 1 < 1 evaluates to false, the upsert is rejected, and
--   the user sees "Connected successfully but could not save
--   credentials. Please try again." (error=save_failed).
--
-- Fix:
--   Add a SECURITY DEFINER helper that detects whether a platform row
--   already exists for the given (creator_id, platform) pair, then
--   update the INSERT policy to allow reconnects without consuming a
--   new slot. Only brand-new connections are gated by the tier limit.
-- =============================================================

-- ---------------------------------------------------------------------------
-- Helper: does a connected_platforms row already exist for this pair?
--
-- Must be SECURITY DEFINER so it can read connected_platforms without
-- triggering RLS, which would cause infinite recursion inside a policy
-- that itself lives on connected_platforms.
-- ---------------------------------------------------------------------------
create or replace function platform_already_connected(
  p_creator_id uuid,
  p_platform   platform_name
)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from connected_platforms
    where creator_id = p_creator_id
      and platform   = p_platform
  );
$$;

-- ---------------------------------------------------------------------------
-- Replace the INSERT policy to allow reconnects unconditionally (they
-- update an existing row, not consuming a new platform slot) while still
-- enforcing the tier limit for genuinely new connections.
-- ---------------------------------------------------------------------------
drop policy "connected_platforms: owner insert" on connected_platforms;

create policy "connected_platforms: owner insert"
  on connected_platforms for insert
  with check (
    -- Ownership: row must belong to the authenticated creator
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and (
      -- Reconnect: platform row already exists → this upsert is an UPDATE
      -- under the hood, so it does not consume a new platform slot.
      platform_already_connected(creator_id, platform)
      or
      -- New connection: active platform count must be below the tier limit.
      get_active_platform_count(creator_id) < (
        select get_platform_limit(c.subscription_tier)
        from creators c
        where c.id = creator_id
      )
    )
  );
