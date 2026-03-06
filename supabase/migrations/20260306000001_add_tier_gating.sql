-- =============================================================
-- Meridian – Subscription Tier Gating
-- Migration: 20260306000001_add_tier_gating.sql
--
-- 1. Helper functions that return per-tier limits for platform
--    connections and monthly repurpose jobs.
-- 2. Replace the connected_platforms INSERT policy so it also
--    enforces the platform-count limit for the creator's tier.
--    (Reconnecting an existing platform goes through UPDATE, so
--    the count check only fires for brand-new platform rows.)
-- =============================================================

-- ---------------------------------------------------------------------------
-- Helper: maximum connected platforms allowed for a given tier
-- ---------------------------------------------------------------------------
create or replace function get_platform_limit(tier subscription_tier)
returns int language sql immutable as $$
  select case tier
    when 'free'    then 1
    when 'creator' then 3
    when 'pro'     then 2147483647
  end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: maximum repurpose jobs per calendar month for a given tier
-- ---------------------------------------------------------------------------
create or replace function get_repurpose_monthly_limit(tier subscription_tier)
returns int language sql immutable as $$
  select case tier
    when 'free'    then 5
    when 'creator' then 20
    when 'pro'     then 2147483647
  end;
$$;

-- ---------------------------------------------------------------------------
-- Replace connected_platforms INSERT policy to enforce tier limit.
--
-- The existing "connected_platforms: owner insert" policy only verified
-- ownership. We drop it and recreate it with an additional check that the
-- creator hasn't already reached their tier's platform limit.
--
-- Note: upsert-on-conflict (reconnect) triggers UPDATE, not INSERT, so
-- re-connecting an existing platform bypasses this count gate correctly.
-- ---------------------------------------------------------------------------
drop policy "connected_platforms: owner insert" on connected_platforms;

create policy "connected_platforms: owner insert"
  on connected_platforms for insert
  with check (
    -- ownership: row must belong to the authenticated creator
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    -- tier gate: existing platform count must be below the tier's limit
    and (
      select count(*)
      from connected_platforms cp
      where cp.creator_id = creator_id
    ) < (
      select get_platform_limit(c.subscription_tier)
      from creators c
      where c.id = creator_id
    )
  );
