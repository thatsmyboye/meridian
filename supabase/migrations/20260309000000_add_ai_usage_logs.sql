-- =============================================================
-- Meridian – AI Usage Logs
-- Migration: 20260309000000_add_ai_usage_logs.sql
--
-- Tracks every Anthropic API call made by the application,
-- capturing token counts, cost estimates, rate-limit proximity,
-- and contextual metadata for cost accounting and monitoring.
-- =============================================================

create table ai_usage_logs (
  id              uuid        default gen_random_uuid() primary key,
  creator_id      uuid        references creators(id) on delete set null,
  function_name   text        not null,
  model           text        not null,
  input_tokens    integer     not null default 0,
  output_tokens   integer     not null default 0,
  cost_usd        numeric(12, 8) not null default 0,
  metadata        jsonb       default '{}'::jsonb,
  created_at      timestamptz default now() not null
);

-- ── Indexes for common query patterns ──────────────────────────────────────
create index idx_ai_usage_logs_creator_id  on ai_usage_logs (creator_id);
create index idx_ai_usage_logs_created_at  on ai_usage_logs (created_at desc);
create index idx_ai_usage_logs_model       on ai_usage_logs (model);
create index idx_ai_usage_logs_function    on ai_usage_logs (function_name);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Writes are done exclusively via the service-role key in Inngest functions.
-- No direct user-facing read policies; admin queries use service-role.
alter table ai_usage_logs enable row level security;
