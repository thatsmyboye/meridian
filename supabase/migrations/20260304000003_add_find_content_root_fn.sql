-- =============================================================
-- Meridian – Add find_content_root() helper function
-- Migration: 20260304000003_add_find_content_root_fn.sql
--
-- Walks up the parent_content_item_id chain in a single recursive
-- CTE query, avoiding the N+1 per-hop round-trips of the previous
-- JS implementation. Returns the root content item id for the given
-- item and creator, stopping at the first ancestor with no parent.
-- =============================================================

create or replace function find_content_root(
  p_item_id   uuid,
  p_creator_id uuid
)
returns uuid
language sql
stable
security definer
as $$
  with recursive ancestor_chain as (
    -- Seed: start from the requested item (must belong to the creator)
    select id, parent_content_item_id
      from content_items
     where id = p_item_id
       and creator_id = p_creator_id

    union all

    -- Recurse: follow each parent link upward, staying within the creator's items
    select c.id, c.parent_content_item_id
      from content_items c
      join ancestor_chain a on c.id = a.parent_content_item_id
     where c.creator_id = p_creator_id
  )
  select id
    from ancestor_chain
   where parent_content_item_id is null
   limit 1;
$$;

comment on function find_content_root(uuid, uuid) is
  'Returns the root ancestor id of a content_items lineage tree for the given '
  'creator. Uses a recursive CTE so the full parent chain is walked in a single '
  'DB round-trip rather than N sequential queries.';
