-- =============================================================
-- Meridian – Fix infinite recursion in connected_platforms INSERT policy
-- Migration: 20260307000000_fix_platform_count_policy.sql
--
-- The tier-gating INSERT policy added in 20260306000001 queried
-- connected_platforms from within a policy ON connected_platforms,
-- causing "infinite recursion detected in policy" errors on upsert.
--
-- Fix: extract the self-referencing count into a SECURITY DEFINER
-- function, which runs as its owner and bypasses RLS, breaking the
-- recursive loop. Also fixes an unqualified `creator_id` reference
-- in the original subquery that would have counted across all creators.
-- =============================================================

create or replace function get_active_platform_count(p_creator_id uuid)
returns bigint
language sql
security definer
stable
as $$
  select count(*)
  from connected_platforms
  where creator_id = p_creator_id
    and status != 'disconnected'
$$;

drop policy "connected_platforms: owner insert" on connected_platforms;

create policy "connected_platforms: owner insert"
  on connected_platforms for insert
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and get_active_platform_count(creator_id) < (
      select get_platform_limit(c.subscription_tier)
      from creators c
      where c.id = creator_id
    )
  );
