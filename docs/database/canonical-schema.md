# PartyPlaylist Canonical Database Schema

**Status:** PRD-05 authoritative (live Neon / `src/lib/db.ts` shape)  
**Backup:** `snap-odd-dream-abwtma9w` (`partyplaylist-pre-prd-program-2026-07-26-2000`)  
**Migration runner:** `npm run db:migrate:canonical`  
**Not canonical:** Drizzle 4-table model (`spotify_tokens`, JSONB `requests`) — quarantined under `src/lib/db/_quarantine/`

## Architectural decision

Runtime data access standardises on **`pg` + singleton `getPool()`** with typed helpers/services. One ordered SQL migration history under `src/lib/db/migrations/canonical/`. The incomplete parallel Drizzle schema is deprecated and must not receive new tables.

## Event model

| Surface | Table | Role |
| --- | --- | --- |
| Organiser control / status | `events` | Status (`offline`/`standby`/`live`), JSONB `config`, version, device |
| Guest-facing party session | `user_events` | Access code / pin, bypass token, active window, HMAC hashes (PRD-04) |

Both are retained. Guest URLs and display tokens bind to **`user_events`**. Organiser state machine binds to **`events`**. Dated removal of either is out of scope until a dedicated PRD; do not collapse them in Class D without human approval.

Song requests belong to an organiser via **`requests.user_id`** (required in application code). **PRD-06** adds optional `requests.event_id`, `idempotency_key`, archive stamps, and `provider_operations` (Class B expand-and-contract; no Class D drops).

## Core tables

| Table | Ownership / lifecycle |
| --- | --- |
| `users` | Account; session authority columns; email verify hashes |
| `events` | Per-user control event; FK → `users` CASCADE |
| `user_events` | Guest party session; FK → `users` CASCADE |
| `display_tokens` | Short-lived display entry; FK → `user_events` + `users` |
| `requests` | Flat track columns + `user_id` tenant scope |
| `spotify_auth` | Per-user Spotify credentials (plaintext + envelope dual-read) |
| `oauth_sessions` | Single-use PKCE state |
| `user_settings` / `event_settings` | Settings (multi-tenant vs legacy singleton) |
| `password_reset_tokens` | Reset tokens (+ hash column) |
| `spotify_playback_sync` | Cron lease / playback fingerprint |
| `cache_entries` | Server cache |
| `notifications` | In-app notify rows |
| `support_errors` / `support_activity` | Support console |
| `admins` | Legacy username admins (bootstrap); prefer `users.role` |
| `settings` | Legacy key/value |
| `schema_migrations` | Migration history (`id`, `applied_at`) |

## Migration history

| Id | Class | Notes |
| --- | --- | --- |
| `001_baseline_canonical` | B | Idempotent CREATE IF NOT EXISTS |
| `002_auth_session_email` | B | Session + email/reset columns |
| `003_requests_user_id` | B | Tenant column + indexes (no NULL backfill) |
| `004_spotify_playback_sync` | B | Playback sync + cache (replaces request-time DDL) |
| `005_prd03_token_encryption` | B | Already applied on Neon; Class C/D deferred |
| `006_prd04_token_hashes` | B | Already applied on Neon; Class C/D deferred |
| `007_prd06_reliability` | B | Event/request archive, idempotency, provider_operations, playback freshness |
| `008_prd06_request_status_check` | B | Widen requests.status CHECK + claim_started_at |
| `009_prd07_playback_provider` | B | playback_mode, manual_now_playing, provider-neutral request fields, app-owned queue; track_uri nullable |
| `010_prd08_paid_beta_readiness` | B | lifecycle/readiness fields, guardrail settings, beta_entitlements, legal_pages, observation checklists |
| `011_prd09_party_pass_payments` | B | stripe_customers, party_pass_purchases/entitlements, webhook ledger, audit + funnel (no card data) |
| `012_user_events_updated_at` | B | Add `user_events.updated_at` (live Neon gap; Ready / setPlaybackMode) |

## Human stops (Class C/D)

- **PRD-03 Class C:** safer expand-only dual-write **ran** (`npm run db:backfill:class-c -- --confirm`) — envelopes written; plaintext retained. Full plaintext nulling still deferred while `main` is live on shared Neon.
- Do **not** drop Spotify plaintext columns (PRD-03 Class D) — deferred; would break live `main`.
- **PRD-04 Class C:** hash/HMAC backfill **ran** (same script; plaintext retained).
- Do **not** drop plaintext pin/access_code/bypass/token columns (PRD-04 Class D).
- Do **not** run quarantined `0001_migrate_7_to_4_tables.sql`.
- Do **not** re-enable destructive 4-digit purge via HTTP; bootstrap-only residual remains behind `ALLOW_DB_BOOTSTRAP=1`.

## Connection strategy

- **Canonical:** `getPool()` in `src/lib/db.ts` (`PG_POOL_MAX`, default 10).
- **HTTP neon client:** `src/lib/db/neon-client.ts` still used by some auth routes (documented debt; consolidate later).
- **Deprecated:** `src/lib/db/connection-pool.ts` multi-pool + drizzle manager.

## Related docs

- Runner usage: `docs/database/MIGRATION_RUNNER.md`
- Quality gates debt: `docs/database/QUALITY_GATE_DEBT.md`
- Programme status: `docs/plans/PartyPlaylist_Cursor_PRD_Pack_2026/IMPLEMENTATION_STATUS.md`
