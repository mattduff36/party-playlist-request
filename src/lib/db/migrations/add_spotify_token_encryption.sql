-- PRD-03 Class B (additive / expand): encrypted Spotify credential envelopes.
-- Backup before apply: snap-odd-dream-abwtma9w (partyplaylist-pre-prd-program-2026-07-26-2000).
--
-- Classification:
--   Class B — ADD COLUMN / CREATE INDEX / make code_verifier nullable for new encrypted rows
--   Class C — BACKFILL encrypting existing plaintext tokens — DEFERRED (needs human approval)
--   Class D — DROP plaintext access_token / refresh_token / code_verifier — DEFERRED (needs human approval)
--
-- Rollback (Class B reverse): DROP the new columns only after confirming no readers depend on them.
-- A rollback must NOT print decrypted tokens.

ALTER TABLE spotify_auth
  ADD COLUMN IF NOT EXISTS access_token_envelope TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_envelope TEXT,
  ADD COLUMN IF NOT EXISTS token_key_version TEXT,
  ADD COLUMN IF NOT EXISTS refresh_lock_version BIGINT NOT NULL DEFAULT 0;

-- Allow encrypted-only credential rows (plaintext nulled on new writes).
-- Not Class D: columns retained for dual-read / rollback.
ALTER TABLE spotify_auth
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;

ALTER TABLE oauth_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS code_verifier_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS redirect_id TEXT DEFAULT 'admin_spotify',
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

-- Allow encrypted-only OAuth rows (plaintext verifier left empty / NULL).
ALTER TABLE oauth_sessions
  ALTER COLUMN code_verifier DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_unconsumed
  ON oauth_sessions (user_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spotify_auth_user_id
  ON spotify_auth (user_id);
