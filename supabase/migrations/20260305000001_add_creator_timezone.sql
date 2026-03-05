-- ===========================================================================
-- Add timezone to creators
--
-- timezone — IANA timezone string (e.g. 'America/New_York', 'Europe/London').
--            Defaults to 'UTC'. Used to schedule the weekly digest email at
--            8 AM in the creator's local time every Monday.
-- ===========================================================================

alter table creators
  add column if not exists timezone text not null default 'UTC';
