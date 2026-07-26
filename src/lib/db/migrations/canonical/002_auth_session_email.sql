-- PRD-05 Class B: reconcile auth session + email columns (from legacy SQL files).
-- Idempotent ALTERs for installs that already have the baseline.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_session_id TEXT,
  ADD COLUMN IF NOT EXISTS active_session_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE,
  token_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_active_session
  ON users(active_session_id)
  WHERE active_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
  ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS device_id TEXT;
