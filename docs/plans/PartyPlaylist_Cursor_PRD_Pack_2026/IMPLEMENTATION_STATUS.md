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
