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
| Status | Implemented (local commit; not merged/pushed) |
| Branch | `dev/prd-01-production-lockdown` |
| Database impact | None (code-only; no migrations or schema changes) |
| Depends on | none |

### Outcomes

| Requirement | Result |
| --- | --- |
| Remove public schema / migrate / init-db HTTP triggers | Done — routes deleted (`create-schema`, `migrate/user-settings`); `init-db` already absent |
| Remove browser startup + `/api/startup` | Done — route and `ServerStartup` removed from layout |
| Remove `SYSTEM_STARTUP_TOKEN` / `startup-system-token` | Done — no source usage; removed from `.env.example` |
| Spotify watcher organiser-only; no system-token / substring auth | Done — session JWT only; cron remains at `/api/cron/spotify-sync` with exact `CRON_SECRET` |
| Derive identity from session (ignore body `userId` for authz) | Done |
| Approve → in-process tick (no secret header hop) | Done — `tickUserPlayback` called directly |
| Legacy `/api/display/current` + `/requests` | Done — `410 Gone`, no event/request data |
| `/api/notifications` unauthenticated access | Done — route removed (404) |
| Public liveness only for monitoring health | Done — `{ "status": "ok" }` |
| Metrics / dashboard / database-health → superadmin | Done |
| Harden `client-error` + `monitoring/errors` | Done — size limit, allowlist, stack/route redaction |
| Auth-gate `admin/token-expired` | Done |
| Fail-closed Pusher / IP_SALT in production | Done — helpers + `hashIP` / Pusher factories |
| Security regression tests | Done — `tests/security/prd-01-production-lockdown.spec.ts` |

### Deferred / follow-ups

- Notifications **table** writes via `createNotification` in approve remain (no HTTP surface). Tenant-scoped notification redesign can wait for a later PRD if product still needs the table.
- Distributed rate limiting for client-error intake → PRD-02 / PRD-06.
- Full migration architecture → PRD-05.
- Durable Spotify worker redesign → PRD-06.
- `ignoreBuildErrors` / quality-gate cleanup → PRD-05.

### Env var impact (names only)

- **Removed:** `SYSTEM_STARTUP_TOKEN`
- **Required in production (fail-closed):** `IP_SALT`, `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` (and `NEXT_PUBLIC_PUSHER_KEY` for browser clients)
- **Unchanged:** `CRON_SECRET` (exact Bearer match on `/api/cron/spotify-sync`)

### Validation notes

| Command | Result |
| --- | --- |
| `npm run test:unit` | Pass — 122 tests (incl. 17 PRD-01 security) |
| `npm run build` | Pass |
| Lint on PRD-01 touched files (`--quiet`) | Pass |
| Repo-wide `npm run lint` | Pre-existing failures elsewhere (265 errors / 153 warnings); not introduced by PRD-01 |
| `npm run type-check` | Pre-existing failures across codebase; PRD-01-only `NODE_ENV` assign issues fixed. Stale `.next/types` for deleted routes cleared by `rm -rf .next` before build |
| `npm run test:api` | Not run (needs live server / DB); coverage provided via unit/security tests instead |

Database impact: **none**.
