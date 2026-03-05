-- =============================================================
-- Meridian – Add scheduled publishing support
-- Migration: 20260305000006_add_scheduled_publishing.sql
--
-- Extends repurpose_jobs to support scheduling derivatives for
-- automated publishing via Inngest.
--
-- Changes:
--   1. Add 'scheduled' and 'published' to repurpose_status enum
--      (used at the job level when all derivatives are scheduled/published)
--   2. Add scheduled_derivative_ids JSONB column to repurpose_jobs
--      to track which derivatives have active schedule jobs
--      { [format_key]: schedule_id (UUID) }
-- =============================================================

-- ---------------------------------------------------------------------------
-- 1. Extend repurpose_status enum
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'scheduled' and enumtypid = 'repurpose_status'::regtype
  ) then
    alter type repurpose_status add value 'scheduled';
  end if;

  if not exists (
    select 1 from pg_enum
    where enumlabel = 'published' and enumtypid = 'repurpose_status'::regtype
  ) then
    alter type repurpose_status add value 'published';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Add scheduled_derivative_ids to repurpose_jobs
--    Maps format_key → schedule_id (UUID string) for active schedules.
--    Populated when a derivative is scheduled; entry removed on cancel.
-- ---------------------------------------------------------------------------
alter table repurpose_jobs
  add column if not exists scheduled_derivative_ids jsonb default '{}'::jsonb;

comment on column repurpose_jobs.scheduled_derivative_ids is
  'Maps format_key to the schedule_id UUID used for Inngest job cancellation. '
  'Example: {"twitter_thread": "uuid-v4-here"}. '
  'Entry is removed when the scheduled job is cancelled or completes.';

-- Index for looking up jobs with active scheduled derivatives
create index if not exists idx_repurpose_jobs_scheduled_derivative_ids
  on repurpose_jobs using gin (scheduled_derivative_ids)
  where scheduled_derivative_ids != '{}'::jsonb;
