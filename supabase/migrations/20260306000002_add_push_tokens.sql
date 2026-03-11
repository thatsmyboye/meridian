-- Push notification tokens for Expo Push Notification Service.
-- One row per device per creator. Tokens are upserted on each app launch
-- so stale tokens (e.g. after reinstall) are replaced automatically.

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One row per (creator, token) — upsert target
  unique (creator_id, token)
);

-- Index for fast lookup by creator when sending notifications
create index if not exists push_tokens_creator_id_idx on public.push_tokens(creator_id);

-- RLS: creators can only read/write their own tokens
alter table public.push_tokens enable row level security;

drop policy if exists "Creators manage their own push tokens" on public.push_tokens;
create policy "Creators manage their own push tokens"
  on public.push_tokens
  for all
  using (
    creator_id in (
      select id from public.creators where auth_user_id = auth.uid()
    )
  )
  with check (
    creator_id in (
      select id from public.creators where auth_user_id = auth.uid()
    )
  );

-- updated_at trigger
create or replace function public.set_push_tokens_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_push_tokens_updated_at();
