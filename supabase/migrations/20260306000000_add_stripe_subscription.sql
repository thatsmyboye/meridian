-- =============================================================
-- Meridian – Stripe Subscription Fields
-- Migration: 20260306000000_add_stripe_subscription.sql
--
-- Adds subscription tier and Stripe customer/subscription IDs
-- to the creators table so Stripe webhooks can keep subscription
-- state in sync with the database.
-- =============================================================

-- Subscription tier enum
create type subscription_tier as enum ('free', 'creator', 'pro');

-- Add Stripe fields to creators
alter table creators
  add column subscription_tier subscription_tier not null default 'free',
  add column stripe_customer_id  text unique,
  add column stripe_subscription_id text unique;

-- Index for fast webhook lookups by Stripe customer / subscription ID
create index idx_creators_stripe_customer_id
  on creators (stripe_customer_id)
  where stripe_customer_id is not null;

create index idx_creators_stripe_subscription_id
  on creators (stripe_subscription_id)
  where stripe_subscription_id is not null;
