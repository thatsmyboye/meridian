-- =============================================================
-- Meridian – Add metadata columns to content_items
-- Migration: 20260225000001_add_content_items_metadata.sql
--
-- Adds thumbnail_url and duration_seconds to content_items so
-- the YouTube sync job can populate these fields directly.
-- =============================================================

alter table content_items
  add column if not exists thumbnail_url    text,
  add column if not exists duration_seconds integer;
