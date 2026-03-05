-- =============================================================
-- Meridian – Add derivatives JSONB and review status to repurpose_jobs
-- Migration: 20260305000004_add_derivatives_to_repurpose_jobs.sql
--
-- Stores per-format derivative outputs as a JSONB array so that
-- a single repurpose job can produce multiple format derivatives
-- (e.g. tweet thread, LinkedIn post, newsletter snippet, etc.)
-- each with its own review status.
--
-- Also adds a 'review' value to repurpose_status for the queue.
-- =============================================================

-- Add 'review' and 'approved' to the repurpose_status enum if not present
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'review' and enumtypid = 'repurpose_status'::regtype) then
    alter type repurpose_status add value 'review';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'approved' and enumtypid = 'repurpose_status'::regtype) then
    alter type repurpose_status add value 'approved';
  end if;
end
$$;

-- derivatives: JSONB array of derivative objects
-- Each element: {
--   format: string,
--   content: string,
--   platform: string,
--   char_count: number,
--   status: "pending" | "approved" | "rejected",
--   previous_drafts: string[],
--   created_at: string,
--   updated_at: string
-- }
alter table repurpose_jobs
  add column if not exists derivatives jsonb default '[]'::jsonb;

-- selected_formats: which formats the creator picked for generation
alter table repurpose_jobs
  add column if not exists selected_formats text[] default '{}';

comment on column repurpose_jobs.derivatives is
  'JSONB array of per-format derivative outputs. Each element contains '
  'format, content, platform, char_count, status, and previous_drafts.';

comment on column repurpose_jobs.selected_formats is
  'Array of format keys the creator selected for derivative generation.';
