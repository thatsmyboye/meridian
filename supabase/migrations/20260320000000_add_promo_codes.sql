-- Add trial tracking columns to creators.
--
-- When a promo code is redeemed:
--   pre_trial_tier  ← current subscription_tier (saved so we can revert)
--   trial_tier      ← the tier granted by the trial
--   trial_ends_at   ← expiry timestamp
--   subscription_tier ← overwritten to trial_tier for the duration
--
-- When the trial expires (via expire-trials-cron):
--   subscription_tier ← restored to pre_trial_tier
--   trial_tier, trial_ends_at, pre_trial_tier ← nulled out

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS trial_tier       subscription_tier,
  ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pre_trial_tier   subscription_tier;

-- Index so the expiry cron can efficiently find rows to process.
CREATE INDEX IF NOT EXISTS creators_trial_ends_at_idx
  ON creators (trial_ends_at)
  WHERE trial_tier IS NOT NULL;

-- ─── Promo codes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promo_codes (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The redemption code (stored upper-case, enforced by check constraint).
  code           TEXT         NOT NULL,
  -- Which subscription tier the trial grants.
  tier           subscription_tier NOT NULL,
  -- How many days the trial lasts after redemption.
  duration_days  INTEGER      NOT NULL CHECK (duration_days > 0),
  -- Maximum number of times this code can be redeemed. NULL = unlimited.
  max_uses       INTEGER      CHECK (max_uses IS NULL OR max_uses > 0),
  -- Running redemption counter.
  used_count     INTEGER      NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  -- Optional hard expiry for the code itself (independent of trial duration).
  -- NULL means the code never expires (only the resulting trial does).
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT promo_codes_code_upper CHECK (code = upper(code)),
  CONSTRAINT promo_codes_code_unique UNIQUE (code)
);

-- Row-level security: authenticated users have no direct access.
-- All reads/writes go through the service-role client in API routes.
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Track which creator redeemed which code (prevents double-redemption per code).
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   UUID        NOT NULL REFERENCES promo_codes (id) ON DELETE CASCADE,
  creator_id      UUID        NOT NULL REFERENCES creators (id) ON DELETE CASCADE,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at   TIMESTAMPTZ NOT NULL,

  CONSTRAINT promo_redemptions_unique UNIQUE (promo_code_id, creator_id)
);

ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Creators can read their own redemption records (e.g. to show history).
CREATE POLICY "creators can view own redemptions"
  ON promo_redemptions
  FOR SELECT
  USING (
    creator_id IN (
      SELECT id FROM creators WHERE auth_user_id = auth.uid()
    )
  );
