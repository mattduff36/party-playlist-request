# PRD-03 Migration Notes — Spotify Token Encryption

## Backup

- CLI snapshot: `snap-odd-dream-abwtma9w` (`partyplaylist-pre-prd-program-2026-07-26-2000`)
- Confirmed as the Class B / Class C gate backup for Neon production/`main`.

## Applied status (Neon production / `main`)

| Field | Value |
| --- | --- |
| Class B applied | **YES** |
| Columns / indexes verified present | **YES** |
| Backup | `snap-odd-dream-abwtma9w` |
| `TOKEN_ENCRYPTION_KEY_V1` in local `.env.local` | **NOT set** (awaiting human) |
| Class C | **8 candidate rows**; **AWAITING human approval** — not run |
| Class D | **Deferred** |

## Classifications

| Change | Class | Action |
| --- | --- | --- |
| Add `access_token_envelope`, `refresh_token_envelope`, `token_key_version`, `refresh_lock_version` on `spotify_auth` | **B** | **Applied** on Neon production/`main`; columns/indexes verified |
| Add oauth txn columns (`code_verifier_encrypted`, `consumed_at`, `redirect_id`, `user_id`, `username`); nullable `code_verifier` | **B** | **Applied** via same SQL; verified present |
| Encrypt **existing** production plaintext tokens (backfill) | **C** | **STOP — 8 candidates; awaiting human approval** (not run; impact pack below) |
| Drop plaintext `access_token` / `refresh_token` / `code_verifier` columns | **D** | **STOP — deferred**; requires separate human approval after verified dual-read period |

## Runtime behaviour (this PRD)

- **New writes:** encrypted envelopes only; plaintext columns set to `NULL`.
- **Reads:** prefer envelope decrypt; fall back to plaintext (legacy rows).
- **No automatic backfill** of existing rows.

## Class C backfill — impact pack (do not run yet)

- **Status:** **AWAITING human approval** — not run.
- **Candidates:** **8** `spotify_auth` rows with plaintext tokens eligible for backfill.
- **What:** Read each `spotify_auth` row with plaintext tokens, encrypt into envelopes, null plaintext.
- **Why deferred:** Rewrites existing production secrets in place (Class C). Needs explicit operator command + backup confirmation.
- **Risk if run without approval:** Irreversible ciphertext if vault key is wrong/lost; dual-read window shrinks once plaintext is nulled.
- **Prerequisite:** `TOKEN_ENCRYPTION_KEY_V1` must be set (currently **NOT set** in local `.env.local` — awaiting human).
- **Proposed command (not implemented as auto-run):** future CLI e.g. `npm run migrate:spotify-token-encrypt -- --confirm`.
- **Rollback after Class C:** Restore from `snap-odd-dream-abwtma9w` (or PITR). Do **not** log decrypted tokens during rollback.
## Class D contract (deferred)

After verified dual-read + approved Class C backfill:

1. Confirm zero plaintext rows remain.
2. Separate migration drops plaintext columns.
3. Remove dual-read fallback from `getSpotifyAuth`.

## Rollback of Class B only

```sql
ALTER TABLE spotify_auth
  DROP COLUMN IF EXISTS access_token_envelope,
  DROP COLUMN IF EXISTS refresh_token_envelope,
  DROP COLUMN IF EXISTS token_key_version,
  DROP COLUMN IF EXISTS refresh_lock_version;
-- oauth_sessions additive columns similarly droppable if unused
```

Do not print decrypted token material during rollback.

## Env

- Production **requires** `TOKEN_ENCRYPTION_KEY_V1` (32-byte base64 or 64-char hex).
- Local `.env.local`: `TOKEN_ENCRYPTION_KEY_V1` is **NOT set** (awaiting human). Do not print secret values.
- Optional: `TOKEN_ENCRYPTION_KEY_V2`, `TOKEN_ENCRYPTION_WRITE_KID`.
