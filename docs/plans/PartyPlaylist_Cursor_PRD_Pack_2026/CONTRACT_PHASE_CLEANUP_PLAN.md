# Contract-phase cleanup plan (deferred Class D)

**Status:** Deferred. Do **not** run without explicit human approval after expand-and-contract verification.

Expand-and-contract was used throughout PRD-03/04: additive Class B columns/tables first; dual-read/dual-verify at runtime; plaintext retained until contract phase.

## Backup prerequisite

- Primary: `snap-odd-dream-abwtma9w` (`partyplaylist-pre-prd-program-2026-07-26-2000`)
- Confirm a fresh snapshot immediately before any Class C or Class D operation.

## Phase 1 — Class C backfills (still awaiting approval)

| PRD | Operation | Candidates / scope | Gate |
| --- | --- | --- | --- |
| PRD-03 | Encrypt existing plaintext Spotify tokens into envelopes; null plaintext | **8** `spotify_auth` rows | Human approve + `TOKEN_ENCRYPTION_KEY_V1` set |
| PRD-04 | Backfill HMAC/hash columns from plaintext codes/tokens | Existing events/users with plaintext only | Human approve |

Do not start Class D until Class C is complete and dual-read shows zero residual plaintext need.

## Phase 2 — Class D column drops (contract)

### PRD-03 Spotify credentials

After zero plaintext Spotify token rows remain and dual-read is unused in production for an agreed soak period:

1. Drop `spotify_auth.access_token`, `spotify_auth.refresh_token` (and related plaintext OAuth verifier column if still present).
2. Remove dual-read fallback from token vault read path.
3. Keep envelope columns + key version fields.

### PRD-04 access codes / tokens

After hashes backfilled and verified:

1. Drop plaintext `pin` / `access_code` / `bypass_token` / display `token` / password-reset plaintext / email-verify plaintext columns as applicable.
2. Remove plaintext verify fallthrough when hash present (already fail-closed when hash present).
3. Require hash columns non-null for new writes (already the write path).

### Not in Class D from this programme

- Canonical migrations `001`–`011` are Class B additive; no drop of those new tables/columns in contract phase without a separate product decision.
- Quarantined/historical Drizzle destructive SQL remains out of band (PRD-05).

## Phase 3 — Code cleanup after drops

1. Delete dual-read / plaintext fallback branches.
2. Update unit/security tests that intentionally cover legacy plaintext paths.
3. Update `PRD-03-MIGRATION-NOTES.md` and `IMPLEMENTATION_STATUS.md`.
4. Deploy code that no longer references dropped columns **before** or **with** the drop migration (never leave live code selecting dropped columns).

## Rollback

- Prefer Neon restore from pre-Class-C/D snapshot (`snap-odd-dream-abwtma9w` or a newer pre-op snapshot).
- Do not log decrypted tokens, access codes, or Stripe secrets during recovery.

## Explicit non-actions for preview handover

- No Class C run as part of PRD-09 merge.
- No Class D run as part of PRD-09 merge.
- No contract-phase cleanup on Neon for this handover.
