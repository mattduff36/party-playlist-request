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
| `TOKEN_ENCRYPTION_KEY_V1` in local `.env.local` | **Set** (local untracked; also Vercel Preview only — never commit) |
| Class C | **Ran (safer expand-only variant)** — 8 Spotify rows enveloped; plaintext retained |
| Class D | **Deferred** (would break live `main` on shared Neon) |

## Classifications

| Change | Class | Action |
| --- | --- | --- |
| Add `access_token_envelope`, `refresh_token_envelope`, `token_key_version`, `refresh_lock_version` on `spotify_auth` | **B** | **Applied** on Neon production/`main`; columns/indexes verified |
| Add oauth txn columns (`code_verifier_encrypted`, `consumed_at`, `redirect_id`, `user_id`, `username`); nullable `code_verifier` | **B** | **Applied** via same SQL; verified present |
| Encrypt **existing** production plaintext tokens (backfill) | **C** | **Ran as safer expand-only variant** — dual-write envelopes; **plaintext left intact** while `main` is live |
| Drop plaintext `access_token` / `refresh_token` / `code_verifier` columns | **D** | **STOP — deferred**; would break live `main` on shared Neon |

## Runtime behaviour (this PRD)

- **New writes (app code):** encrypted envelopes; plaintext columns set to `NULL` on reconnect/refresh paths.
- **Reads:** prefer envelope decrypt; fall back to plaintext (legacy / expand-only dual-write rows).
- **Class C backfill (ran):** envelopes written; plaintext retained intentionally (safer variant).

## Class C backfill — safer expand-only variant (ran)

- **Status:** **Complete** via `npm run db:backfill:class-c -- --confirm` (`scripts/backfill-prd03-prd04-class-c.ts`).
- **Backup:** `snap-odd-dream-abwtma9w`.
- **Variant:** dual-write envelopes + `token_key_version`; **do not null plaintext** while production `main` still dual-reads plaintext on the same Neon DB.
- **Full nulling of plaintext:** deferred until new vault code is production (separate approval).
- **Counts (first run):** Spotify candidates/updated **8**; OAuth PKCE **0**; (PRD-04 hashes logged separately in IMPLEMENTATION_STATUS).
- **Idempotent:** re-run skips already-enveloped rows.
- **Prerequisite:** `TOKEN_ENCRYPTION_KEY_V1` (32-byte base64) in `.env.local` + Vercel **Preview** (same key; never commit).
- **Rollback:** Restore from `snap-odd-dream-abwtma9w` (or PITR). Do **not** log decrypted tokens.
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

## Env — `TOKEN_ENCRYPTION_KEY_V1`

- **Format:** 32-byte key as standard base64 (typical 44-char string) or 64-char hex.
- **Local:** set in untracked `.env.local` (generated for this programme). Never commit.
- **Vercel Preview:** set under Project → Settings → Environment Variables → filter/environment **Preview** only.
- **Vercel Production:** **not** set by this programme step (do not change Production env for Preview testing).
- **Why Preview must match local for shared Neon:** envelopes written by the backfill decrypt only with the same key. Preview deployments that decrypt envelopes need that key; live `main` continues via plaintext dual-read until vault code ships to production.
- Optional: `TOKEN_ENCRYPTION_KEY_V2`, `TOKEN_ENCRYPTION_WRITE_KID`.
- Production runtime fail-fast still applies once vault code is on `main` (`src/instrumentation.ts`).
