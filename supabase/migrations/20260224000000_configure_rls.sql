-- =============================================================
-- Meridian – Row-Level Security Policies
-- Migration: 20260224000000_configure_rls.sql
--
-- Enforces owner-only access on all tables.
--
-- Policy template: auth.uid() = creator_id
--
-- Because creator_id on all tables (except creators itself) is a
-- UUID referencing creators.id — not auth.users.id directly — the
-- effective check is:
--   creator_id IN (SELECT id FROM creators WHERE auth_user_id = auth.uid())
--
-- This is semantically identical to the template: only the row
-- owner's JWT can satisfy the condition.
--
-- All CREATE POLICY statements are preceded by DROP POLICY IF EXISTS
-- so this migration is idempotent and safe to re-run (e.g. after a
-- db reset or on Supabase preview branches).
-- =============================================================

-- ===========================================================================
-- TABLE: creators
-- auth_user_id is the direct link to auth.users(id), so comparison is direct.
-- ===========================================================================
alter table creators enable row level security;

drop policy if exists "creators: owner select" on creators;
create policy "creators: owner select"
  on creators for select
  using (auth.uid() = auth_user_id);

drop policy if exists "creators: owner insert" on creators;
create policy "creators: owner insert"
  on creators for insert
  with check (auth.uid() = auth_user_id);

drop policy if exists "creators: owner update" on creators;
create policy "creators: owner update"
  on creators for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

drop policy if exists "creators: owner delete" on creators;
create policy "creators: owner delete"
  on creators for delete
  using (auth.uid() = auth_user_id);

-- ===========================================================================
-- TABLE: connected_platforms
-- ===========================================================================
alter table connected_platforms enable row level security;

drop policy if exists "connected_platforms: owner select" on connected_platforms;
create policy "connected_platforms: owner select"
  on connected_platforms for select
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "connected_platforms: owner insert" on connected_platforms;
create policy "connected_platforms: owner insert"
  on connected_platforms for insert
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "connected_platforms: owner update" on connected_platforms;
create policy "connected_platforms: owner update"
  on connected_platforms for update
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "connected_platforms: owner delete" on connected_platforms;
create policy "connected_platforms: owner delete"
  on connected_platforms for delete
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

-- ===========================================================================
-- TABLE: content_items
-- INSERT and UPDATE also verify that platform_id (when provided) belongs
-- to the same creator, preventing cross-creator foreign key injection.
-- ===========================================================================
alter table content_items enable row level security;

drop policy if exists "content_items: owner select" on content_items;
create policy "content_items: owner select"
  on content_items for select
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "content_items: owner insert" on content_items;
create policy "content_items: owner insert"
  on content_items for insert
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and (
      platform_id is null
      or exists (
        select 1 from connected_platforms cp
        where cp.id = platform_id
          and cp.creator_id = creator_id
      )
    )
  );

drop policy if exists "content_items: owner update" on content_items;
create policy "content_items: owner update"
  on content_items for update
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  )
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and (
      platform_id is null
      or exists (
        select 1 from connected_platforms cp
        where cp.id = platform_id
          and cp.creator_id = creator_id
      )
    )
  );

drop policy if exists "content_items: owner delete" on content_items;
create policy "content_items: owner delete"
  on content_items for delete
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

-- ===========================================================================
-- TABLE: performance_snapshots
-- INSERT and UPDATE also verify that content_item_id belongs to the
-- same creator, preventing orphaned or cross-creator snapshots.
-- ===========================================================================
alter table performance_snapshots enable row level security;

drop policy if exists "performance_snapshots: owner select" on performance_snapshots;
create policy "performance_snapshots: owner select"
  on performance_snapshots for select
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "performance_snapshots: owner insert" on performance_snapshots;
create policy "performance_snapshots: owner insert"
  on performance_snapshots for insert
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and exists (
      select 1 from content_items ci
      join creators c on c.id = ci.creator_id and c.auth_user_id = auth.uid()
      where ci.id = content_item_id
    )
  );

drop policy if exists "performance_snapshots: owner update" on performance_snapshots;
create policy "performance_snapshots: owner update"
  on performance_snapshots for update
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  )
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and exists (
      select 1 from content_items ci
      join creators c on c.id = ci.creator_id and c.auth_user_id = auth.uid()
      where ci.id = content_item_id
    )
  );

drop policy if exists "performance_snapshots: owner delete" on performance_snapshots;
create policy "performance_snapshots: owner delete"
  on performance_snapshots for delete
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

-- ===========================================================================
-- TABLE: pattern_insights
-- ===========================================================================
alter table pattern_insights enable row level security;

drop policy if exists "pattern_insights: owner select" on pattern_insights;
create policy "pattern_insights: owner select"
  on pattern_insights for select
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "pattern_insights: owner insert" on pattern_insights;
create policy "pattern_insights: owner insert"
  on pattern_insights for insert
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "pattern_insights: owner update" on pattern_insights;
create policy "pattern_insights: owner update"
  on pattern_insights for update
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "pattern_insights: owner delete" on pattern_insights;
create policy "pattern_insights: owner delete"
  on pattern_insights for delete
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

-- ===========================================================================
-- TABLE: repurpose_jobs
-- INSERT and UPDATE also verify that source_item_id belongs to the
-- same creator, preventing cross-creator job submission.
-- ===========================================================================
alter table repurpose_jobs enable row level security;

drop policy if exists "repurpose_jobs: owner select" on repurpose_jobs;
create policy "repurpose_jobs: owner select"
  on repurpose_jobs for select
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

drop policy if exists "repurpose_jobs: owner insert" on repurpose_jobs;
create policy "repurpose_jobs: owner insert"
  on repurpose_jobs for insert
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and exists (
      select 1 from content_items ci
      join creators c on c.id = ci.creator_id and c.auth_user_id = auth.uid()
      where ci.id = source_item_id
    )
  );

drop policy if exists "repurpose_jobs: owner update" on repurpose_jobs;
create policy "repurpose_jobs: owner update"
  on repurpose_jobs for update
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  )
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
    and exists (
      select 1 from content_items ci
      join creators c on c.id = ci.creator_id and c.auth_user_id = auth.uid()
      where ci.id = source_item_id
    )
  );

drop policy if exists "repurpose_jobs: owner delete" on repurpose_jobs;
create policy "repurpose_jobs: owner delete"
  on repurpose_jobs for delete
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );
