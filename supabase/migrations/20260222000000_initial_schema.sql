-- =============================================================
-- Meridian – Initial Core Schema
-- Migration: 20260222000000_initial_schema.sql
-- =============================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type platform_name as enum (
  'youtube',
  'instagram',
  'tiktok',
  'twitter',
  'linkedin',
  'podcast',
  'other'
);

create type repurpose_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ===========================================================================
-- TABLE: creators
-- Central profile table, linked 1-to-1 with Supabase auth.users
-- ===========================================================================
create table creators (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null unique references auth.users (id) on delete cascade,
  display_name    text not null,
  email           text not null,
  avatar_url      text,
  bio             text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ===========================================================================
-- TABLE: connected_platforms
-- OAuth / API credentials for each social platform a creator connects
-- ===========================================================================
create table connected_platforms (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references creators (id) on delete cascade,
  platform            platform_name not null,
  handle              text,                         -- @username / channel name
  access_token_enc    text,                         -- encrypted at app layer
  refresh_token_enc   text,
  token_expires_at    timestamptz,
  scopes              text[],
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (creator_id, platform)
);

-- Indexes
create index idx_connected_platforms_creator_id on connected_platforms (creator_id);

-- ===========================================================================
-- TABLE: content_items
-- Individual pieces of content ingested from connected platforms
-- ===========================================================================
create table content_items (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references creators (id) on delete cascade,
  platform_id     uuid references connected_platforms (id) on delete set null,
  external_id     text,                             -- platform-native content ID
  platform        platform_name,
  title           text,
  body            text,
  media_urls      text[],
  tags            text[],
  published_at    timestamptz,
  raw_data        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (creator_id, platform, external_id)
);

-- Indexes
create index idx_content_items_creator_id   on content_items (creator_id);
create index idx_content_items_published_at on content_items (published_at);
create index idx_content_items_platform     on content_items (platform);

-- ===========================================================================
-- TABLE: performance_snapshots
-- Point-in-time metrics for a content item
-- ===========================================================================
create table performance_snapshots (
  id              uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items (id) on delete cascade,
  creator_id      uuid not null references creators (id) on delete cascade,
  snapshot_at     timestamptz not null default now(),
  views           bigint not null default 0,
  likes           bigint not null default 0,
  comments        bigint not null default 0,
  shares          bigint not null default 0,
  saves           bigint not null default 0,
  reach           bigint,
  impressions     bigint,
  raw_data        jsonb
);

-- Indexes
create index idx_performance_snapshots_creator_id      on performance_snapshots (creator_id);
create index idx_performance_snapshots_content_item_id on performance_snapshots (content_item_id);
create index idx_performance_snapshots_snapshot_at     on performance_snapshots (snapshot_at);

-- ===========================================================================
-- TABLE: pattern_insights
-- AI-generated insights derived from a creator's content patterns
-- ===========================================================================
create table pattern_insights (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references creators (id) on delete cascade,
  generated_at    timestamptz not null default now(),
  insight_type    text not null,                    -- e.g. 'top_format', 'best_time', 'engagement_driver'
  summary         text not null,
  evidence_json   jsonb,                            -- supporting data points
  confidence      numeric(4,3),                     -- 0.000 – 1.000
  is_dismissed    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index idx_pattern_insights_creator_id   on pattern_insights (creator_id);
create index idx_pattern_insights_generated_at on pattern_insights (generated_at);

-- ===========================================================================
-- TABLE: repurpose_jobs
-- Tracks a request to repurpose one content item for another platform
-- ===========================================================================
create table repurpose_jobs (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references creators (id) on delete cascade,
  source_item_id    uuid not null references content_items (id) on delete cascade,
  target_platform   platform_name not null,
  status            repurpose_status not null default 'pending',
  prompt_override   text,                           -- optional custom instruction
  output_json       jsonb,                          -- generated repurposed content
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indexes
create index idx_repurpose_jobs_creator_id on repurpose_jobs (creator_id);
create index idx_repurpose_jobs_status     on repurpose_jobs (status);

-- ===========================================================================
-- updated_at auto-update trigger (shared)
-- ===========================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_creators_updated_at
  before update on creators
  for each row execute procedure set_updated_at();

create trigger trg_connected_platforms_updated_at
  before update on connected_platforms
  for each row execute procedure set_updated_at();

create trigger trg_content_items_updated_at
  before update on content_items
  for each row execute procedure set_updated_at();

create trigger trg_pattern_insights_updated_at
  before update on pattern_insights
  for each row execute procedure set_updated_at();

create trigger trg_repurpose_jobs_updated_at
  before update on repurpose_jobs
  for each row execute procedure set_updated_at();
