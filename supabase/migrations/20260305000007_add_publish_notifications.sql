-- =============================================================
-- Meridian – Add publish_notifications table
-- Migration: 20260305000007_add_publish_notifications.sql
--
-- Stores in-app notifications for derivative publish success/failure.
-- Supabase Realtime is enabled on this table so the browser client
-- receives push updates without polling.
--
-- Changes:
--   1. Create publish_notifications table
--   2. Enable RLS with owner-only policies
--   3. Add table to the Supabase Realtime publication
-- =============================================================

-- ---------------------------------------------------------------------------
-- 1. Create table
-- ---------------------------------------------------------------------------
create table if not exists publish_notifications (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references creators (id) on delete cascade,

  -- 'published' or 'failed_publish'
  type              text not null check (type in ('published', 'failed_publish')),

  repurpose_job_id  uuid not null,
  format_key        text not null,

  -- Human-readable labels stored at write time so reads are cheap
  platform_label    text not null,  -- e.g. "Twitter / X Thread"
  content_title     text,           -- source content title for context

  -- For 'published': direct link to the live post
  external_url      text,

  -- For 'failed_publish': link back to the review page so the creator can retry
  retry_url         text,

  -- NULL until the creator opens/dismisses the notification
  read_at           timestamptz,

  created_at        timestamptz not null default now()
);

comment on table publish_notifications is
  'In-app notifications fired when a scheduled derivative publishes or fails. '
  'Realtime is enabled so the browser receives push updates immediately.';

comment on column publish_notifications.retry_url is
  'URL to the derivative review page; only populated for failed_publish notifications.';

-- Index for fast per-creator unread queries (the common case)
create index if not exists idx_publish_notifications_creator_unread
  on publish_notifications (creator_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security
-- ---------------------------------------------------------------------------
alter table publish_notifications enable row level security;

-- Creators can only see their own notifications
drop policy if exists "publish_notifications: owner select" on publish_notifications;
create policy "publish_notifications: owner select"
  on publish_notifications for select
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

-- The service-role key (used by Inngest) bypasses RLS for inserts.
-- The authenticated client can mark its own notifications as read.
drop policy if exists "publish_notifications: owner update" on publish_notifications;
create policy "publish_notifications: owner update"
  on publish_notifications for update
  using (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  )
  with check (
    creator_id in (
      select id from creators where auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Enable Realtime
--    Adds the table to the default supabase_realtime publication so that
--    clients can subscribe to INSERT/UPDATE changes via Supabase channels.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table publish_notifications;
