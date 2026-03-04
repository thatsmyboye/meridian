-- =============================================================
-- Meridian – Add parent_content_item_id to content_items
-- Migration: 20260304000002_add_parent_content_item.sql
--
-- Enables derivative/repurposed content to reference its source.
-- A null value means the item is an original (root) piece of content.
-- =============================================================

alter table content_items
  add column if not exists parent_content_item_id uuid
    references content_items (id) on delete set null;

comment on column content_items.parent_content_item_id is
  'References the original content item this was derived from (e.g. a YouTube clip '
  'repurposed as an Instagram Reel). NULL for original content.';

create index if not exists idx_content_items_parent_id
  on content_items (parent_content_item_id)
  where parent_content_item_id is not null;
