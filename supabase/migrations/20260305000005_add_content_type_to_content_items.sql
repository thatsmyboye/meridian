-- =============================================================
-- Meridian – Add content_type to content_items
-- Migration: 20260305000005_add_content_type_to_content_items.sql
-- =============================================================
--
-- Adds a content_type column to content_items so that manually
-- pasted text (newsletters, blog posts, etc.) can be tracked
-- distinctly from platform-synced content.
--
-- content_type = 'text_import' → creator pasted text directly;
--                                 platform is NULL for these rows.
-- content_type = NULL          → existing platform-synced content
--                                 (backwards-compatible default).

alter table content_items
  add column if not exists content_type text;

-- Index to make filtering text_import items fast
create index if not exists idx_content_items_content_type
  on content_items (content_type);
