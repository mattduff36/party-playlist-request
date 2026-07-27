-- PRD-04 Class B (additive / expand): hash/HMAC columns for access codes, display tokens,
-- password-reset tokens, and email-verification tokens.
-- Backup before apply: snap-odd-dream-abwtma9w (partyplaylist-pre-prd-program-2026-07-26-2000).
--
-- Classification:
--   Class B — ADD COLUMN / CREATE INDEX (this file)
--   Class C — BACKFILL hashes from plaintext — DEFERRED (needs human approval)
--   Class D — DROP plaintext pin/access_code/bypass_token/token columns — DEFERRED
--
-- Rollback (Class B reverse): DROP the new columns only after confirming no readers depend on them.
-- Never log plaintext codes/tokens in migration output.

ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS access_code_hmac TEXT,
  ADD COLUMN IF NOT EXISTS access_code_hmac_version TEXT,
  ADD COLUMN IF NOT EXISTS bypass_token_hash TEXT;

ALTER TABLE display_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_prefix TEXT;

ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_display_tokens_token_hash
  ON display_tokens (token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
  ON password_reset_tokens (token_hash)
  WHERE token_hash IS NOT NULL AND used = false;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
