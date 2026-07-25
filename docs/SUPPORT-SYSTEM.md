# Support System

Party Playlist includes a Postgres-backed support console for superadmins.

## Access

1. Sign in as a superadmin.
2. Open **Super Admin → Support** (4th tab).
3. Unresolved error count appears as a badge on the tab.

## What is stored

### `support_errors`

- Uncaught API failures, Spotify API failures (429/5xx), client ErrorBoundary reports, window errors
- Fields: level, source, message, stack (truncated), route, user, IP hash, meta (redacted), resolved flag
- **Classification:** `handled` (expected/recoverable — rate limits, auth denials) vs `unhandled` (true issues)
- **Dedup:** open rows share a `fingerprint`; repeats bump `occurrence_count` / `last_seen_at` instead of inserting floods
- Support badge counts **unhandled** open rows only; Errors panel defaults to unhandled and shows occurrence counts
- Retention: **90 days** (pruned when Support errors are loaded)

### `npm run fixerrors`

- Clusters open rows by fingerprint / normalized message / route / status
- Reports distinct issues + hit counts (not thousands of duplicate lines)
- Marks handled/noise clusters as non-actionable; use `--resolve` after triage

### `support_activity`

| Actor | What’s logged |
|-------|----------------|
| Admin / Superadmin | Full audit of mutations (login/logout, approve/reject, settings, Spotify disconnect, etc.) |
| Guest | High-signal only: request submit, PIN success/failure, login failures — **not** every search keystroke |

## Panels

- **Errors** — filter, inspect stack, mark resolved  
- **Activity** — chronological audit feed  
- **Health** — live checks from `src/lib/monitoring/health.ts` + unresolved count + process uptime  
- **Drill-down** — combined timeline by username or event id  

## Client capture

- Root `ErrorBoundary` + `ClientErrorCapture` post to `/api/support/client-error` (rate-limited)
- Also mirrored through `/api/monitoring/errors` for metrics

## Privacy

OK to store username, user id, event id, route, IP hash, user agent. Secrets (passwords, tokens, cookies) are redacted before insert.

## Out of scope

- Tickets, email alerts, impersonation, force Spotify disconnect from Support UI  
