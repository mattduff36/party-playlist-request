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
| Status | Implemented on branch (not merged into preview; awaiting security review) |
| Branch | `dev/prd-02-session-authority` |
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
| CSRF + same-origin for cookie mutations | Done — double-submit cookie/`X-CSRF-Token`; central `authenticatedFetch` |
| Auth route rate limiting | Done — Redis when available; in-memory degraded (not unbounded) when Redis missing |
| Security audit events | Done — structured stdout JSON (`security-audit`) for login/transfer/logout/reset/event.end/revoked |
| Negative session-abuse tests | Done — `tests/security/prd-02-session-authority.spec.ts` |

### Incomplete / follow-ups

- Not every non-AdminDataContext client fetch path uses `authenticatedFetch` yet (e.g. some superadmin UI / login page transfer uses plain fetch — login/transfer are pre-cookie or password-bodied).
- Durable audit table not added (Class B optional) — stdout structured logs only for this pass.
- Distributed Redis rate-limit cross-instance proof deferred to environments with Upstash configured (memory backend covered in unit tests).
- UI `SESSION_REVOKED` redirect helper exists (`handleSessionRevokedResponse`) but is not wired into every admin fetch call site yet.
- Email-change / privilege-change session rotation not fully enumerated beyond password reset.

### Validation notes

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 146 tests |
| `npm run build` | Pass |
| Merged into preview | No (orchestrator after security review) |
| Pushed | No |
