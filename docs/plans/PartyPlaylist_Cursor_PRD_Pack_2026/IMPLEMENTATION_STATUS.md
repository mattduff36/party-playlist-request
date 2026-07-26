# PartyPlaylist PRD Pack 2026 — Implementation Status

## Database backup

| Field | Value |
| --- | --- |
| Provider | Neon Postgres (project `neon-purple-flower`) |
| Manual snapshot (human-confirmed) | `main@2026-07-26T19:10:55Z (manual)` |
| CLI snapshot id | `snap-odd-dream-abwtma9w` |
| CLI snapshot name | `partyplaylist-pre-prd-program-2026-07-26-2000` |
| CLI created | `2026-07-26T19:13:35Z` |
| CLI branch | `main` (`br-shy-math-abig49x1`) |
| PITR history retention | 24h |
| Snapshot expiry | none (no expiry on CLI snapshot) |
| Primary programme backup identifier | Prefer named CLI snapshot `snap-odd-dream-abwtma9w` / `partyplaylist-pre-prd-program-2026-07-26-2000` for later PRDs |
| Confirmed by human | yes (manual); CLI snapshot verified via Neon CLI |
| Gate | Class B+ DB writes now permitted subject to classification/approval rules; Class C/D still require explicit human approval |
| Restore | Neon Console → Backup & restore → restore from snapshot/instant restore per Neon docs; do not execute restore from this doc |

## PRD-01: Production Lockdown

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-01-production-lockdown` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `83d62e6` |
| Database impact | None (code-only; no migrations or schema changes) |
| Depends on | none |

### Outcomes

| Requirement | Result |
| --- | --- |
| Remove public schema / migrate / init-db HTTP triggers | Done — routes deleted (`create-schema`, `migrate/user-settings`); `init-db` already absent |
| Remove browser startup + `/api/startup` | Done — route and `ServerStartup` removed from layout |
| Remove `SYSTEM_STARTUP_TOKEN` / `startup-system-token` | Done — no source usage under `src/**`; removed from `.env.example` |
| Spotify watcher organiser-only; no system-token / substring auth | Done — session JWT only; cron at `/api/cron/spotify-sync` |
| Derive identity from session (ignore body `userId` for authz) | Done |
| Approve → in-process tick (no secret header hop) | Done — `tickUserPlayback` called directly |
| Legacy `/api/display/current` + `/requests` | Done — `410 Gone`, no event/request data |
| `/api/notifications` unauthenticated access | Done — route removed (404) |
| Public liveness only for monitoring health | Done — `{ "status": "ok" }` |
| Metrics / dashboard / database-health → superadmin | Done |
| Harden `client-error` + `monitoring/errors` | Done — size/allowlist + shared per-IP rate limit; alerting gated behind limiter |
| Auth-gate `admin/token-expired` | Done — route requires session JWT; publishes to `getAdminChannel(userId)` (not global `admin-updates`). Full Pusher private-channel auth hardening deferred to PRD-04 |
| Fail-closed Pusher env / IP_SALT in production | Done — missing Pusher/IP_SALT env fails closed in production helpers; `hashIP` / `getIpHash` rethrow in production. Does **not** claim complete private-channel authorization (PRD-04) |
| Remove unauthenticated DDL via `initializeDefaults` | Done — removed from all `src/app/api/**` handlers; bootstrap gated behind `ALLOW_DB_BOOTSTRAP=1` (CLI only) |
| Cron fail-closed on `CRON_SECRET` | Done — exact Bearer required always; unset secret → 401; dropped `x-vercel-cron` alone path |
| Security regression tests | Done — `tests/security/prd-01-production-lockdown.spec.ts` |

### Independent security review (follow-up fixes)

| Finding | Severity | Fix |
| --- | --- | --- |
| `initializeDefaults()` → DDL before auth/guest gates on public + support routes | BLOCKING | Removed all request-path calls; `initializeDatabase` refuses without `ALLOW_DB_BOOTSTRAP=1`; architectural test over `src/app/api/**` |
| `/api/cron/spotify-sync` fails open when `CRON_SECRET` unset / `x-vercel-cron` alone | BLOCKING | Always require Bearer `CRON_SECRET` (timing-safe); missing/wrong → 401 |
| `/api/monitoring/errors` unbounded (no rate limit) | BLOCKING/HIGH | Shared limiter with `/api/support/client-error`; alerts after limit check |
| `token-expired` published to global `admin-updates` | MEDIUM | Publish to `getAdminChannel(auth.user.user_id)` |
| `getIpHash` swallowed `IP_SALT` errors as `unknown` | MEDIUM | Rethrow in production; intake routes return 503 |
| Docs still referenced deleted migrate route | LOW | `docs/APPROVAL-MESSAGE-FEATURE.md` updated |
| `SYSTEM_STARTUP_TOKEN` absence test too narrow | LOW | Walks `src/**` source files |

### Deferred / follow-ups

- Notifications **table** writes via `createNotification` in approve remain (no HTTP surface). Tenant-scoped notification redesign can wait for a later PRD if product still needs the table.
- Distributed rate limiting for client-error intake → PRD-02 / PRD-06.
- Full migration architecture → PRD-05 (includes retiring residual DDL such as `ensurePlaybackSyncTable` in sync ticks).
- Durable Spotify worker redesign → PRD-06.
- `ignoreBuildErrors` / quality-gate cleanup → PRD-05.
- **PRD-04 deferred (explicit non-goal for this pass):** full Pusher private-channel auth hardening beyond tenant-scoping `token-expired`.

### Env var impact (names only)

- **Removed:** `SYSTEM_STARTUP_TOKEN`
- **Required in production (fail-closed):** `CRON_SECRET`, `IP_SALT`, `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` (and `NEXT_PUBLIC_PUSHER_KEY` for browser clients)
- **CLI-only (never set on request handlers):** `ALLOW_DB_BOOTSTRAP` — required to run `initializeDefaults` / `initializeDatabase` locally; schema otherwise via migrations
- **Note:** Production Vercel Cron will 401 until `CRON_SECRET` is configured (intentional fail-closed). Do not commit or print secret values.

### Validation notes

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 130 tests (incl. 25 PRD-01 security) |
| `npm run build` | Pass |
| Lint on PRD-01 touched files (`--quiet`) | Pass (prior) |
| Repo-wide `npm run lint` | Pre-existing failures elsewhere; not introduced by PRD-01 |
| `npm run type-check` | Pre-existing failures across codebase |
| `npm run test:api` | Not run (needs live server / DB); coverage via unit/security tests |

### Preview integration smoke (post-merge `83d62e6` + docs soften)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 130 tests |
| `npm run build` | Pass |
| Pushed to remote | No (local only; production confirmed = `main` only) |

Database impact: **none** (no migrations, no DB writes from this change set).

## PRD-02: Authentication / Session Authority

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-02-session-authority` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `4004dbc` (source tip `5ff2a1e`) |
| Database impact | None (code-only; uses existing `users.active_session_id` / account columns). No Class C/D migrations. |
| Depends on | PRD-01 integrated into preview |

### Outcomes

| Requirement | Result |
| --- | --- |
| Authoritative async admin guard (`session_id` vs `active_session_id`) | Done — `requireAuth` is async; loads DB row; returns `SESSION_REVOKED` |
| Apply guard to protected routes | Done — all prior `requireAuth` call sites awaited (admin/superadmin/spotify/monitoring/auth/me/refresh/event) |
| Refresh rejects revoked sessions | Done — refresh uses authoritative guard; no JSON token mint from claims alone |
| Transfer validates `oldSessionId` | Done — conditional UPDATE; mismatch → 409; rotates session (revokes old JWTs) |
| Logout ≠ end event / delete requests | Done — logout clears cookie + conditional session release only |
| End-event distinct + non-destructive | Done — `/api/event/status` offline no longer `DELETE FROM requests`; audits `event.end` |
| CSRF + same-origin for cookie mutations | Done — double-submit cookie/`X-CSRF-Token`; organiser/superadmin mutations use `authenticatedFetch` |
| Cookie-first token extraction | Done — `extractToken` prefers HttpOnly `auth_token` over Bearer; clients strip stale `localStorage.admin_token` Bearer |
| `SESSION_REVOKED` UI | Done — `authenticatedFetch` calls `handleSessionRevokedResponse`; AdminDataContext distinguishes revoked vs expired (no refresh loop) |
| Auth route rate limiting | Done — Redis when available; in-memory degraded (not unbounded) when Redis missing |
| Security audit events | Done — structured stdout JSON (`security-audit`) for login/transfer/logout/reset/event.end/revoked |
| Negative session-abuse tests | Done — `tests/security/prd-02-session-authority.spec.ts` (stale JWT, event end, refresh, logout newer-session, CSRF, cookie-first) |

### Auth decision (cookie-first)

Browser organiser/superadmin auth is **cookie-canonical**: HttpOnly `auth_token` + CSRF double-submit. Preferring Bearer first let stale `localStorage.admin_token` override a valid cookie while credentials still attached the cookie (dual path). Bearer remains for cookie-less API/tests. `@/lib/auth` `requireSuperAdmin(req)` now throws (deprecated); use middleware `requireAuth` + `requireSuperAdmin`.

### Incomplete / follow-ups

- Login / transfer / register / guest PIN / public request posts correctly remain plain `fetch` (pre-cookie or unauthenticated).
- Some admin GETs still use raw `fetch` with `credentials: 'include'` (CSRF N/A for safe methods); mutations migrated.
- Durable audit table not added (Class B optional) — stdout structured logs only for this pass.
- Distributed Redis rate-limit cross-instance proof deferred to environments with Upstash configured (memory backend covered in unit tests).
- Email-change / privilege-change session rotation not fully enumerated beyond password reset.
- HttpOnly cookie expiry UX: browser cannot read `auth_token` max-age; any client-side "session expires at" UI remains approximate / refresh-driven (not a security gap).
- Dead `admin_token` localStorage: API path is cookie-first and strips Bearer from stale `admin_token`, but some UI may still write/read the key for legacy display — cleanup of remaining localStorage mirrors deferred (non-blocking).
- Email-change / privilege-change session rotation not fully enumerated beyond password reset.

### Validation notes (on feature branch before merge)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 151 tests (incl. PRD-02 security + CSRF client wiring) |
| `npm run build` | Pass |
| Independent re-review | APPROVE_MERGE @ `5ff2a1e` |
| Merged into preview | Yes — `4004dbc` |
| Pushed | No |

### Preview integration smoke (post-merge `4004dbc` + status docs)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 151 tests |
| `npm run build` | Pass |
| Pushed to remote | No (prefer local; production = `main` only) |

Database impact: **none** (no migrations, no DB writes from this change set).

## PRD-03: Spotify OAuth / Token Security

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-03-spotify-token-security-20260726` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `fe4d4a9` (source tip `da4197c`) |
| Database impact | **Class B applied** to Neon production/`main` (YES). Verified columns/indexes present. Backup: `snap-odd-dream-abwtma9w`. **Class C:** 8 candidate rows, AWAITING human approval — not run. **Class D:** deferred. See `PRD-03-MIGRATION-NOTES.md`. |
| Depends on | PRD-02 integrated into preview |
| Independent re-review | APPROVE_MERGE @ `da4197c` |
| Deploy gates (human) | `TOKEN_ENCRYPTION_KEY_V1` must be set in `.env.local` + production before deploy (never commit). Class C backfill awaiting human. Class D deferred. Class B already on Neon. |

### Outcomes

| Requirement | Result |
| --- | --- |
| Remove `/api/spotify/oauth-session` | Done — route deleted |
| Server-owned PKCE exchange; no verifier to browser | Done — GET callback consumes txn + exchanges; POST → 410 |
| Auth code not left in browser URL long-term | Done — redirect result uses `spotify=connected` / `spotify_error=…` only |
| Atomic single-use state bound to user | Done — hashed state PK; `UPDATE … consumed_at … RETURNING`; prior unconsumed invalidated |
| Encrypt tokens at rest (expand) | Done — AES-256-GCM vault; dual-read plaintext+envelope; new writes encrypted + plaintext NULL |
| Concurrent refresh locking/CAS | Done — `refresh_lock_version` + `setSpotifyAuthCas` |
| Redact sensitive logging | Done — callback/auth/exchange logs redacted |
| Disconnect clears oauth sessions | Done — disconnect + admin reset + user delete |
| Production vault fail-fast | Done — `assertTokenVaultConfiguredForProduction()` via `src/instrumentation.ts` |

### Migration status (Neon production / `main`)

| Field | Value |
| --- | --- |
| Class B applied | **YES** (`add_spotify_token_encryption.sql`) |
| Columns / indexes verified present | **YES** |
| Backup | `snap-odd-dream-abwtma9w` |
| `TOKEN_ENCRYPTION_KEY_V1` in local `.env.local` | **NOT set** (awaiting human) |
| Class C backfill | **8 candidate rows**; **AWAITING human approval** — not run |
| Class D (drop plaintext columns) | **Deferred** |

### Human stop (Class C/D)

- **Do not run** production plaintext → ciphertext backfill without approval (Class C; 8 candidates).
- **Do not drop** plaintext token columns (Class D).
- Impact pack: `docs/plans/PartyPlaylist_Cursor_PRD_Pack_2026/PRD-03-MIGRATION-NOTES.md`

### Incomplete / follow-ups

- **Class B:** Applied on Neon (complete; columns/indexes verified).
- **`TOKEN_ENCRYPTION_KEY_V1`:** Missing locally — must be set in `.env.local` and production before deploy (never commit the value). Production startup fails fast without it.
- **Class C:** 8 candidate rows — awaiting explicit human approval (not run).
- Class D column drop deferred after dual-read verification.
- Existing connected users keep working via plaintext dual-read until they reconnect (new writes encrypted) or Class C runs.
- Full typed error mapping coverage for every Spotify API call path beyond OAuth/refresh/search (partial).

### Validation notes (on feature branch before merge)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — PRD-03 security + behavioral negatives (cross-user, replay, decrypt leak) |
| `npm run build` | Pass |
| Independent re-review | APPROVE_MERGE @ `da4197c` |
| Merged into preview | Yes — `fe4d4a9` |
| Pushed | No |

### Preview integration smoke (post-merge `fe4d4a9` + status docs)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 173 tests |
| `npm run build` | Pass |
| Pushed to remote | No (prefer local; production = `main` only) |

### Deploy / human stops (PRD-03)

- **`TOKEN_ENCRYPTION_KEY_V1`:** Required before production deploy; fail-fast via `src/instrumentation.ts`. Not set in committed files.
- **Class B:** Already applied on Neon (`add_spotify_token_encryption.sql`); columns/indexes verified. Backup `snap-odd-dream-abwtma9w`.
- **Class C:** 8 candidate plaintext rows — **AWAITING human approval** — do not backfill.
- **Class D:** Drop plaintext token columns — **deferred**.

## PRD-04: Tenant / Guest / Display / Realtime Isolation

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-04-tenant-realtime-isolation-20260726` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `04081bf` (source tip `5885dbb`) |
| Database impact | **Class B applied** to Neon (`add_prd04_token_hash_columns.sql`). Backup: `snap-odd-dream-abwtma9w`. **Class C:** backfill hashes from plaintext — AWAITING human. **Class D:** drop plaintext — deferred. |
| Depends on | PRD-02 + PRD-03 integrated into preview |
| Independent re-review | APPROVE_MERGE @ `5885dbb` |

### Outcomes

| Requirement | Result |
| --- | --- |
| Explicit channel allowlist + ownership auth | Done — `channel-contract.ts` + hardened `/api/pusher/auth` |
| Guest cannot auth admin/display channels | Done — guest proof only for guest/legacy party channels |
| Display channel requires display session | Done — `pp_display_access` cookie after atomic token consume |
| Migrate off public `event-{id}` with dual-publish | Done — **public dual-publish removed**; publish to `private-event-{id}-guest` + `private-event-{id}-display` only |
| Presence channels default-deny | Done — `/api/pusher/auth` returns 403 for `presence-*` (no anonymous authorize) |
| Display token client path (`?dt=`) | Done — `DisplayAuthGate` → `verify-display-token` → `pp_display_access` → `display-session` → private display channel |
| Gate `/api/users/lookup` UUID disclosure | Done — `410 USER_LOOKUP_RETIRED`; clients use `/api/events/guest-session` |
| Event-access policy service | Done — `event-access-policy.ts` (+ guest-session / display-session / pusher proofs) |
| Atomic display-token use | Done — `UPDATE … WHERE uses_remaining > 0 … RETURNING` |
| Hash/HMAC access codes & tokens (expand-and-contract) | Done — dual-verify; plaintext only when hash null/empty (no fallthrough if hash present; matches display-token SQL incl. reset-password / verify-email); `verifyAccessCode` fails closed (no plaintext SQL catch fallback); plaintext columns retained (no Class D drop) |
| Tenant-scoped request repos | Done — required `userId`; allowlisted `updateRequest` fields; hardened deprecated `getRequestsByStatusOld` / `database-service.updateRequestStatus` |
| Negative cross-tenant tests | Done — `tests/security/prd-04-tenant-realtime-isolation.spec.ts` |
| Legacy display 410 | Already from PRD-01 (unchanged) |

### Migration status (Neon)

| Field | Value |
| --- | --- |
| Class B applied | **YES** (`access_code_hmac`, `bypass_token_hash`, `display_tokens.token_hash`/`token_prefix`, `password_reset_tokens.token_hash`, `users.email_verification_token_hash`) |
| Columns verified present | **YES** |
| Backup | `snap-odd-dream-abwtma9w` |
| Class C backfill | **AWAITING human approval** — not run |
| Class D drop plaintext | **Deferred** |

### Human stops

- **Class C:** Do not backfill existing plaintext codes/tokens into hash columns without approval.
- **Class D:** Do not drop plaintext `pin` / `access_code` / `bypass_token` / `token` / reset / email-verify columns.
- Optional env: `ACCESS_CODE_HMAC_SECRET` (falls back to `JWT_SECRET`).

### Incomplete / follow-ups

- Legacy `private-party-playlist-{userId}` still authorised for guest+owner during migration.
- Canonical `private-user-{userId}-admin` parsed/allowed but clients still use `private-admin-updates-{userId}`.
- Guest cookie still embeds access code (httpOnly JWT) for dual-verify until opaque guest sessions.
- Access-code display path still uses guest private channel (not display channel); display-token `?dt=` path uses display channel.
- Username-only `/api/public/event-config` still returns entry-page config (titles/messages) without guest proof — limited public status; request lists remain guest-gated.
- `/api/events/public-status` still returns `event.id` for hydration; safe only because public `event-{id}` publish is gone.
- Concurrent display-token race covered by atomic SQL; no dedicated multi-worker integration race test.
- **PRD-03 deploy gate still open:** `TOKEN_ENCRYPTION_KEY_V1` must be set before production deploy (never commit). Class C/D human gates remain for both PRD-03 and PRD-04.

### Human stops (Class C/D — do not run without approval)

- **PRD-03 Class C:** 8 candidate plaintext Spotify token rows — AWAITING human approval.
- **PRD-03 Class D:** Drop plaintext Spotify token columns — deferred.
- **PRD-04 Class C:** Backfill existing plaintext codes/tokens into hash columns — AWAITING human approval.
- **PRD-04 Class D:** Drop plaintext `pin` / `access_code` / `bypass_token` / `token` / reset / email-verify columns — deferred.
- **Deploy:** `TOKEN_ENCRYPTION_KEY_V1` still required before production deploy (PRD-03).

### Validation notes (feature branch)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — reset/email-verify hash-present deny + verifyAccessCode fail-closed |
| `npm run build` | Pass |
| Independent re-review | APPROVE_MERGE @ `5885dbb` |
| Merged into preview | Yes — `04081bf` |
| Pushed | No |

### Preview integration smoke (post-merge `04081bf` + status docs)

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 204 tests |
| `npm run build` | Pass |
| Pushed to remote | No (prefer local; production = `main` only) |

## PRD-05: Canonical Database Architecture, Migrations and Quality Gates

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-05-canonical-database-ci-20260726` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `cae2960` (source tip `43cf95f`) |
| Database impact | **Class B applied** — `001`–`006` via `db:migrate:canonical` (idempotent; stamped in `schema_migrations`). No Class C/D. Backup: `snap-odd-dream-abwtma9w`. |
| Depends on | PRD-01…04 integrated into preview |
| Independent re-review | APPROVE_MERGE @ `43cf95f` |

### Outcomes (this pass)

| Requirement | Result |
| --- | --- |
| Canonical schema documented | Done — `docs/database/canonical-schema.md` (live multi-tenant; keep `events` + `user_events`) |
| Versioned SQL migration runner | Done — `npm run db:migrate:canonical` (`src/lib/db/migrate/*`) |
| Reconcile migration history | Done — ordered `001`–`006` including PRD-03/04 Class B copies |
| Stop request-time DDL | Done — `ensurePlaybackSyncTable` + `initializeCacheTable` verify-only; API still has no `initializeDatabase` |
| Quarantine conflicting Drizzle 7→4 | Done — `src/lib/db/_quarantine/drizzle-legacy/`; drizzle npm scripts disabled |
| Fix poll route to live schema | Done — `getPool` + flat `requests` / `spotify_auth` |
| Centralise pools (partial) | Done — login + superadmin routes use `getPool()`; multi-pool manager deprecated |
| CI workflow | Done — type-check + lint + unit + build hard-fail |
| Remove next.config ignore flags | Done — `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` removed |
| Dry-run write-free | Done — `--dry-run` skips `ensureMigrationsTable` / CREATE |
| Disable spotify_tokens foot-gun scripts | Done — `db:create-indexes` / `db:create-constraints` (+ analyze/validate/studio) exit 1; sources quarantined |
| Full repository split | **Deferred** — compatibility `db.ts` + residual `database-service` drizzle event helpers remain |
| Neon HTTP client consolidation | **Deferred** — `neon-client.ts` still used by some auth routes |
| Playwright smoke / test:api in CI | **Deferred** |

### DB classification (this branch)

| Change | Class | Action |
| --- | --- | --- |
| `001`–`006` canonical SQL (IF NOT EXISTS / ADD COLUMN) | B | **Applied** after dry-run inspect |
| Stamp `schema_migrations` rows | B | **Applied** (`001`–`006`) |
| Class C secret backfills (PRD-03/04) | C | **STOP** — human |
| Class D column drops | D | **STOP** — human |
| Quarantined 7→4 destructive SQL | D/destructive | **DO NOT RUN** |

### Human stops

- Do not apply Class C/D from prior PRDs.
- Do not run `_quarantine/drizzle-legacy/0001_migrate_7_to_4_tables.sql`.
- Inspect before `db:migrate:canonical` against production Neon (prefer dry-run / branch first).
- `TOKEN_ENCRYPTION_KEY_V1` deploy gate from PRD-03 still open.

### Incomplete / follow-ups

- Quality gates for type-check / lint / unit / build are **accepted** (lint errors cleared; CI lint hard-fail; ignore flags removed). See `docs/database/QUALITY_GATE_DEBT.md` for residual warnings / scoped disables.
- Rewrite `database-service` off drizzle multi-pool onto `getPool`.
- Consolidate `neon-client` call sites onto singleton pool (or document exceptional edge use).
- Fresh-DB integration test in CI with ephemeral Postgres.
- README architecture rewrite / MIT licence cleanup (PRD stretch).

### Validation notes (feature branch)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass — 0 errors (CI hard-fail) |
| `npm run lint` | Pass — 0 errors (CI hard-fail; warnings remain) |
| `npm run test:unit` | Pass |
| `npm run build` | Pass (no eslint/ts ignore flags) |
| Merged into preview | Yes — `cae2960` |
| Pushed | No |
| PRD-05 quality-gate acceptance | **Complete** for type-check + lint + unit + build hard gates |

### Human gates (still open — do not run without approval)

- **PRD-03 Class C:** 8 candidate plaintext Spotify token rows — AWAITING human approval.
- **PRD-03 Class D:** Drop plaintext Spotify token columns — deferred.
- **PRD-04 Class C:** Backfill existing plaintext codes/tokens into hash columns — AWAITING human approval.
- **PRD-04 Class D:** Drop plaintext pin/access_code/bypass_token/token/reset/email-verify columns — deferred.
- **Deploy:** `TOKEN_ENCRYPTION_KEY_V1` required before production deploy (never commit).
- **PRD-05:** No additional Class C/D from this PRD; do not run quarantined 7→4 destructive SQL.

### Preview integration smoke (post-merge `cae2960` + hygiene)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass |
| `npm run lint` | Pass (warnings remain; 0 errors) |
| `npm run test:unit` | Pass — 213 tests |
| `npm run build` | Pass |
| Hygiene | Removed unused stale `.eslintrc.json` (ESLint 9 flat `eslint.config.mjs` only) |
| Pushed to remote | No (prefer local; production = `main` only) |

## PRD-06: Distributed Reliability, Concurrency Safety and Event Data Integrity

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-06-distributed-reliability-20260726` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `ca5e420` (source tip `af3f9ad`) |
| Database impact | **Class B applied** — `007_prd06_reliability` (2026-07-26T21:40:08.704Z); `008_prd06_request_status_check` (2026-07-26T21:44:54.546Z) widens `requests_status_check` + `claim_started_at`. **No Class C/D.** Backup: `snap-odd-dream-abwtma9w`. |
| Depends on | PRD-05 integrated into preview |
| Independent re-review | APPROVE_MERGE @ `af3f9ad` |

### Outcomes (this pass)

| Requirement | Result |
| --- | --- |
| Distributed guest rate limits (event+device primary, IP secondary) | Done — `enforceGuestRateLimit`; Redis→memory; secondary uses `secondaryMaxMultiplier` ceiling under NAT (memory + Redis) |
| Guest device cookie | Done — `pp_guest_device` |
| Idempotent guest submission | Done — required UUID `idempotency_key`; unique `(event_id, idempotency_key)`; transactional duplicate check |
| Concurrent approval claim | Done — claim + stuck-`approving` reclaim after timeout; `releaseApprovalClaim` on catch; `queue_failed` on failure |
| Uncertain ledger (no second Spotify copy) | Done — `shouldAttemptSpotifyQueueAdd` skips `uncertain`; approve + auto-approve reconcile only |
| Playback refresh + staleness | Done — `refreshPlaybackState` on approve, admin `spotify-watcher`, public `playback-sync` (debounce + fetched_at/degraded) |
| Event end archives history | Done — `archiveEventOnEnd` on offline; logout unchanged (non-destructive) |
| Cleanup requires confirmation | Done — `DELETE_ARCHIVED_EVENT_DATA` + archived-only delete |
| Queue reorder honest capability | Done — `501 CAPABILITY_NOT_SUPPORTED` |
| Load/fault suite (150 guests / multi-instance) | Partial — unit/concurrency guardrail tests; full load scripts deferred |
| Unify dual event writes / optimistic version everywhere | Partial — archive stamps + existing `events.version`; dual `events`/`user_events` retained per PRD-05 |
| Retention anonymisation job | Deferred |

### DB classification

| Change | Class | Action |
| --- | --- | --- |
| `007` ADD COLUMN / CREATE TABLE provider_operations / indexes | B | **Applied** on Neon (`schema_migrations.id=007_prd06_reliability`) |
| `008` DROP/re-ADD `requests_status_check` (expand: `approving`, `queue_failed`) + `claim_started_at` | B | **Applied** on Neon (`schema_migrations.id=008_prd06_request_status_check` at 2026-07-26T21:44:54.546Z) after write-free dry-run. Prior CHECK: pending\|approved\|rejected\|queued\|failed\|played |
| Class C secret backfills (PRD-03/04) | C | **STOP** — human |
| Class D column drops | D | **STOP** — human |

### Human stops

- Do not apply Class C/D from prior PRDs.
- Class B `007` / `008` applied on Neon after dry-run (backup `snap-odd-dream-abwtma9w`).
- `TOKEN_ENCRYPTION_KEY_V1` deploy gate from PRD-03 still open.
- Uncertain Spotify queue reconciliation UI/ops runbook still human (no automatic second enqueue).

### Incomplete / follow-ups

- Full 150-guest / multi-instance fault scripts not shipped (unit guardrails only) — **deferred load scripts**.
- Search cache + Spotify 429 cooldown Maps remain process-local (non-correctness for security; document).
- Nickname anonymisation cron / retention job not implemented.
- Uncertain ledger recovery is read-only / operator reconcile — no Spotify queue peek automation.
- UI may still expose reorder controls — API now refuses; disable control in admin UI follow-up (PRD-07 app-owned queue makes reorder truthful).
- **`cleanup-played` policy:** still deletes played rows after 1h — product retention policy confirmation deferred (separate from PRD-06 merge).

### Validation notes (feature branch)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass (FIX_THEN_MERGE pass) |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass — includes PRD-06 claim/uncertain/secondary RL suite |
| `npm run build` | Pass |
| Merged into preview | Yes — `ca5e420` |
| Pushed | No |

### Preview integration smoke (post-merge `ca5e420` + status docs)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass — 234 tests |
| `npm run build` | Pass |
| Pushed to remote | No (prefer local; production = `main` only) |

### Deferred notes (explicit)

| Item | Status |
| --- | --- |
| Full 150-guest / multi-instance load & fault scripts | Deferred (unit concurrency guardrails only) |
| `cleanup-played` 1h delete of played rows | Deferred product policy confirmation — not changed by this merge |

## PRD-07: Playback Provider Abstraction and Spotify-Independent Manual Mode

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-07-playback-manual-mode-20260726` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `36d343f` (source tip `73e9b48`) |
| Database impact | **Class B applied** — `009_prd07_playback_provider` after write-free dry-run. Adds `playback_mode`, `manual_now_playing`, provider-neutral request fields, app-owned `queue_position`/`queue_version`; expands `track_uri` to nullable. **No Class C/D.** Backup: `snap-odd-dream-abwtma9w`. |
| Depends on | PRD-06 integrated into preview (`ca5e420`) |
| Independent re-review | APPROVE_MERGE @ `73e9b48` |

### Outcomes (this pass)

| Requirement | Result |
| --- | --- |
| PlaybackProvider capability contract | Done — `src/lib/playback/*` |
| Spotify adapter wrapping existing service | Done — `SpotifyPlaybackProvider` |
| Manual request-only provider | Done — no OAuth/Premium/device; text requests |
| Capability-aware UI / routes | Done — sidebar hides Spotify controls in manual; playback routes 501 when unsupported; `play-again` / `previous` gated |
| App-owned queue reorder | Done — `/api/admin/queue/reorder` via `reorderAppOwnedQueue` (Spotify native still 501) |
| Event-level mode selection + audit | Done — `/api/admin/playback-mode`; `playback.mode_changed` audit |
| Manual now-playing + mark played | Done — admin routes + minimal UI (`ManualNowPlayingControls`; request-list Now playing / Mark played) |
| Guest manual form + display label | Done — ManualRequestForm; display-data `mode_label`; display shows label; skips Spotify `playback-sync` in manual mode |
| Provider contract + behavioral tests | Done — `prd-07-playback-provider.spec.ts` + `prd-07-playback-behavior.spec.ts` (mode-switch non-destructive, capability 501, VERSION_CONFLICT) |
| Just-in-time Spotify enqueue on top-of-queue | Deferred — approve still enqueues when `queueAdd` + `add_to_queue` (Spotify path preserved) |
| Full admin edit/correct metadata UI | Partial — allowlisted update fields; dedicated edit/copy UI deferred |
| Concurrent reorder version-safe under multi-worker load test | Partial — SQL FOR UPDATE + version check + unit conflict coverage; load script deferred |

### FIX_THEN_MERGE follow-up (this commit)

| Blocker | Result |
| --- | --- |
| R1 Minimal admin UI for manual now-playing + mark played | Done — capability-aware; hidden when not manual |
| R2 Gate Spotify-only `play-again` / `previous` → 501 | Done |
| R3 Display `mode_label` + skip Spotify heartbeat in manual | Done (client + server) |
| R4 Behavioral unit tests | Done |

### DB classification

| Change | Class | Action |
| --- | --- | --- |
| `009` ADD COLUMN playback_mode / manual_now_playing / provider fields / queue_* ; `track_uri` DROP NOT NULL | B | **Applied** on Neon after dry-run (`schema_migrations.id=009_prd07_playback_provider`) |
| Class C secret backfills (PRD-03/04) | C | **STOP** — human |
| Class D column drops | D | **STOP** — human |

### Human stops

- Do not apply Class C/D from prior PRDs.
- `TOKEN_ENCRYPTION_KEY_V1` deploy gate from PRD-03 still open.

### Incomplete / follow-ups

- Just-in-time Spotify queue add (prefer over immediate on approve) not defaulted yet.
- Dedicated organiser UI to edit/correct request metadata and copy artist-title from queue panel.
- Display reconnect polish for manual now-playing beyond `display-data` / `now-playing` payloads.
- Full end-to-end Playwright for no-Spotify event flow deferred.
- Apple Music / YouTube providers remain non-goals.

### Validation notes (feature branch)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass (FIX_THEN_MERGE pass) |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass (incl. PRD-07 contract + behavior suites) |
| `npm run build` | Pass |
| Merged into preview | Yes — `36d343f` |
| Pushed | No |

### Preview integration smoke (post-merge `36d343f` + status docs)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass — 255 tests |
| `npm run build` | Pass |
| Pushed to remote | No (prefer local; production = `main` only) |

## PRD-08: Paid Beta Product Readiness, Event Setup and Customer Deliverables

| Field | Value |
| --- | --- |
| Status | Integrated into preview |
| Branch | `dev/prd-08-paid-beta-readiness-20260726` |
| Preview branch | `preview/partyplaylist-prd-program-2026` |
| Merge commit | `5f65b49` (source tip `eaf02c3`) |
| Database impact | **Class B applied** — `010_prd08_paid_beta_readiness` after write-free dry-run. Adds lifecycle/readiness columns, guardrail settings, `beta_entitlements` (+ audit), `legal_pages`, `beta_observation_checklists`. **No Class C/D.** Backup: `snap-odd-dream-abwtma9w`. |
| Depends on | PRD-07 integrated into preview (`36d343f`) |
| Independent re-review | APPROVE_MERGE @ `eaf02c3` |

### Outcomes (this pass)

| Requirement | Result |
| --- | --- |
| Lifecycle phases alongside operational status | Done — `lifecycle_phase` + started/ended stamps; runtime still `offline\|standby\|live` |
| Guided readiness wizard + score/gate | Done — `/admin/wizard` + `/api/admin/readiness`; required checks block Ready; warning override audited |
| Event-day recovery centre | Done — `/admin/recovery` + `/api/admin/recovery` |
| Printable QR signage PDFs | Done — pdfkit server PDFs (A4/A5/table/16:9); access code opt-in; guest URLs only |
| Event archive report + CSV | Done — `/admin/history` + `/api/admin/events/.../report` (+ `format=csv` requests **and** audit actions); no raw IPs |
| Event templates | Done — blank/birthday/anniversary/house/wedding_reception via `/api/admin/templates` |
| Guardrails | Done — do-not-play / artist cooldown / max active per guest enforced on `/api/request`; must-play stored; API for lists |
| Beta entitlement grants | Done — SA grant/revoke API + UI shield action; gates offline→standby/live in production |
| Demo mode (no Spotify credentials) | Done — `/api/admin/demo-mode` toggle works; credential ops fail-closed when demo active (OAuth / vault / refresh / disconnect) |
| Legal pages with review status | Done — privacy/terms/cookies/retention/refund/spotify disconnect/organiser duties (draft_unreviewed) |
| Observed beta checklist | Done — `/api/admin/observation-checklist` + 11-item catalogue |
| Unit tests | Done — `tests/unit/prd-08-paid-beta-readiness.spec.ts` (incl. FIX_THEN_MERGE R1–R3) |

### FIX_THEN_MERGE follow-up (this commit)

| Blocker | Result |
| --- | --- |
| R1 `/api/admin/demo-mode` POST broken by unconditional `assertDemoDoesNotTouchSpotify` | Done — toggle no longer asserts; assert is conditional on demo active |
| R2 Demo credential isolation on OAuth / token vault / refresh / disconnect | Done — `assertUserDemoDoesNotTouchSpotify` in `db` vault helpers + Spotify auth/callback/disconnect/reset routes (403 / `demo_mode_blocked`) |
| R3 Event report CSV missing audit actions | Done — `buildEventReportCsv` emits request + `audit_action` sections from `support_activity` |
| Unit tests for R1–R3 | Done |

### DB classification

| Change | Class | Action |
| --- | --- | --- |
| `010` ADD COLUMN lifecycle/readiness/guardrails; CREATE beta_entitlements, legal_pages, observation checklists | B | **Applied** on Neon after dry-run (`schema_migrations.id=010_prd08_paid_beta_readiness`) |
| Class C secret backfills (PRD-03/04) | C | **STOP** — human |
| Class D column drops | D | **STOP** — human |

### Human stops

- Do not apply Class C/D from prior PRDs.
- `TOKEN_ENCRYPTION_KEY_V1` deploy gate from PRD-03 still open.
- Do not push until explicitly instructed.
- Production beta activation requires super-admin grant (or `BETA_ENTITLEMENT_BYPASS=1` — do not set in prod).
- Legal copy remains `draft_unreviewed` until professional review.

### Incomplete / follow-ups

- Dedicated must-play / do-not-play organiser list UI (API + settings hooks present; full list editor deferred).
- Full scripted Playwright beta rehearsal (50+ requests / iOS-Android QR) deferred — unit/PDF/gate coverage shipped.
- Concurrent multi-worker guardrail stress beyond unit matching deferred.
- Automated axe accessibility suite for wizard/guest entry deferred.
- Stripe live checkout / public payment → PRD-09 (non-goal).
- Durable security-audit table still deferred (CSV audit actions use `support_activity`; stdout `security-audit` remains for PRD-02 events).

### Validation notes (feature branch)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass (FIX_THEN_MERGE pass) |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass (incl. PRD-08 R1–R3) |
| `npm run build` | Pass |
| `npm run db:migrate:canonical:dry` | Pending `010` reported |
| `npm run db:migrate:canonical` | Applied `010` |
| Merged into preview | Yes — `5f65b49` |
| Pushed | No |

### Preview integration smoke (post-merge `5f65b49` + status docs)

| Command | Result |
| --- | --- |
| `npm run type-check` | Pass |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass |
| `npm run build` | Pass |
| Pushed to remote | No (prefer local; production = `main` only) |

## PRD-09: £19.99 Party Pass Payments, Entitlements and Commercial Launch Controls

| Field | Value |
| --- | --- |
| Status | Implemented on feature branch (not merged into preview) |
| Branch | `dev/prd-09-party-pass-payments` |
| Preview branch | `preview/partyplaylist-prd-program-2026` (do not merge yet) |
| Database impact | **Class B applied** — `011_prd09_party_pass_payments` after write-free dry-run. Adds `stripe_customers`, `party_pass_purchases`, `party_pass_entitlements`, `stripe_webhook_events`, `party_pass_audit`, `party_pass_funnel_events`. **No Class C/D.** Backup: `snap-odd-dream-abwtma9w`. |
| Depends on | PRD-08 integrated into preview (`5f65b49`) |

### Outcomes (this pass)

| Requirement | Result |
| --- | --- |
| Server-side Stripe Checkout (£19.99 GBP) | Done — price via server `price_data` / optional `STRIPE_PARTY_PASS_PRICE_ID`; client price/user/duration ignored |
| Webhook signature + idempotency | Done — raw body verify; unique `stripe_event_id` ledger; failed rows retryable |
| Webhook amount/currency gate | Done — `checkout.session.completed` requires `currency=gbp` and `amount_total` = catalogue (`partyPassAmountPence`) or stored purchase amount; rejects `no_payment_required`; binds/verifies `stripe_checkout_session_id`; mismatches logged as `ignored` (no entitlement, no Stripe retry storm) |
| Purchase ≠ activated; activate starts 30d | Done — entitlement `purchased` until explicit `/api/payments/activate` with `confirm: true` |
| Feature flag / production disable | Done — requires `PARTY_PASS_CHECKOUT_ENABLED=1` + `sk_test_*`; live keys refused |
| Refund / dispute safe handling | Done — webhook marks purchase + entitlement `refunded` / `disputed` |
| Expiry enforcement | Done — opportunistic expire + activation gate via `assertCanActivatePaidEvent` |
| Activation + purchase UI | Done — `/pricing`, `/account/party-pass`, admin settings card + nav |
| Payment security tests | Done — `tests/unit/prd-09-*.spec.ts` + `tests/security/prd-09-*.spec.ts` (incl. duplicate `stripe_event_id` no-op, amount mismatch reject, signature required) |
| Unified gate with beta grants | Done — event start uses Party Pass **or** PRD-08 beta entitlement |

### DB classification

| Change | Class | Action |
| --- | --- | --- |
| `011` CREATE payment/entitlement/webhook/audit/funnel tables | B | **Applied** on Neon after dry-run (`schema_migrations.id=011_prd09_party_pass_payments`) |
| Class C secret backfills (PRD-03/04) | C | **STOP** — human |
| Class D column drops | D | **STOP** — human |

### Stripe env presence (names only — local `.env.local` at implement time)

| Variable | Present |
| --- | --- |
| `STRIPE_SECRET_KEY` | NO |
| `STRIPE_WEBHOOK_SECRET` | NO |
| `STRIPE_PUBLISHABLE_KEY` | NO |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | NO |
| `STRIPE_PARTY_PASS_PRICE_ID` / `STRIPE_PRICE_ID` | NO |
| `PARTY_PASS_CHECKOUT_ENABLED` | NO |

Checklist: `docs/plans/PartyPlaylist_Cursor_PRD_Pack_2026/PRD-09-ENV-CHECKLIST.md`

### Human stops

- **Credentials:** Stripe test keys + webhook secret required before end-to-end Checkout rehearsal (code complete; checkout stays disabled without flag + `sk_test_*`).
- Do not apply Class C/D from prior PRDs.
- Do not merge PRD-09 into preview until programme asks.
- Do not push until explicitly instructed.
- Do not enable `PARTY_PASS_CHECKOUT_ENABLED=1` on production until Spotify/manual hard gates + reviewed legal copy.
- Live Stripe keys are refused in this build (test mode only).

### Incomplete / follow-ups

- End-to-end Stripe test-mode checkout rehearsal blocked on human credentials.
- Stripe Customer Portal requires portal configuration in Stripe Dashboard.
- Full Playwright purchase→activate→event flow deferred.
- VAT/tax determination out of scope (non-goal).
- Subscription / Party Plus tiers out of scope (non-goal).

### Validation notes (feature branch)

| Command | Result |
| --- | --- |
| `npm run db:migrate:canonical:dry` | Pending `011` reported |
| `npm run db:migrate:canonical` | Applied `011` |
| `npm run type-check` | Pass |
| `npm run lint` | Pass (0 errors; warnings remain) |
| `npm run test:unit` | Pass — 296 tests (incl. PRD-09 amount/currency gate + idempotency) |
| `npm run build` | Pass |
| Merged into preview | No |
| Pushed | No |
