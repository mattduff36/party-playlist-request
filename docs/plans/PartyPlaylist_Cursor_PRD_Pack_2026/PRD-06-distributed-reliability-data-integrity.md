# PRD-06: Distributed Reliability, Concurrency Safety and Event Data Integrity


## Mandatory Cursor execution rules

This is an implementation specification, not a prompt-optimisation request. Inspect the repository and implement the PRD directly.

### Create a new development branch first

Before changing any source file:

1. Run `git status --short`.
2. Do not discard, reset, stash, overwrite or commit unrelated user work.
3. Start from the latest accepted project baseline, normally `main` after earlier PRDs have been merged.
4. Create a new development branch specifically for this PRD:

```bash
git switch main
git pull --ff-only
git switch -c dev/prd-06-distributed-reliability-<YYYYMMDD>
```

Replace `<YYYYMMDD>` in the branch name with the date the build starts. If the repository does not use `main`, identify the accepted default branch and create the new branch from that branch instead. If the intended branch already exists, create a new uniquely suffixed branch. Never implement a PRD directly on `main`, `master` or a production branch.

### Working rules

- Read the whole PRD before editing.
- Treat the current source code as authoritative when historical documentation disagrees.
- Keep the implementation inside this PRD's scope. Record useful out-of-scope discoveries instead of silently expanding the build.
- Do not run destructive commands against a production database.
- Create a database backup before any real migration. Use a local or non-production database for development and tests.
- Preserve existing user-facing behaviour unless this PRD explicitly changes it for security, correctness or product reasons.
- Add or update automated tests for every changed security boundary and important behaviour.
- Do not suppress TypeScript, ESLint, test or build failures. Fix failures caused by this PRD.
- Never add secrets to source control, fixtures, screenshots, logs or documentation.
- Update relevant documentation and `.env.example` entries.
- Commit the completed PRD locally with a clear conventional commit message. Do not push unless the user explicitly instructs Cursor to push.

### Required completion report

At the end, report:

- Branch name
- Commit hash and message
- Files added, changed and removed
- Database migrations and rollback notes
- Commands and tests run, including exact results
- Manual checks completed
- Remaining risks, assumptions and deferred items
- Any required environment-variable or deployment changes

## Metadata

- Priority: P1/P2 reliability
- Depends on: PRD-05 merged
- Primary references: COR-07 through COR-10 and PERF-02 through PERF-10

## Objective

Make the application behave correctly across multiple serverless instances and under event-day concurrency. Replace process-local coordination used for correctness, prevent duplicate Spotify queue actions, make request submission idempotent and retain event history.

## Current verified problems

- Spotify watcher state, rate limits, caches, metrics and coordination use process-local Maps/timers.
- Two concurrent approvals can both queue the same track before database status changes.
- Duplicate check and insert are separate operations.
- IP-only rate limiting unfairly groups guests behind venue Wi-Fi/NAT.
- Queue reorder reports success even though Spotify playback order is not changed.
- Logout/end-event behaviour historically destroys request data.
- Fallback paths can return apparent success while underlying services are stale or unavailable.

## Required outcomes

### 1. Define shared-state boundaries

Use Redis/Upstash for data that must coordinate across instances:

- Rate-limit counters with TTL
- Short-lived Spotify search/track validation cache
- Playback refresh lock/debounce
- Event presence/heartbeat where needed
- Idempotency result cache where database uniqueness alone is insufficient

Do not move durable business records from PostgreSQL into Redis. Redis loss must not lose event/request history.

Production behaviour when Redis is unavailable must be explicit:

- Security rate limits fail safe according to PRD-02 policy.
- Playback/status enters a visible degraded mode.
- Guest submission may use database-only safeguards rather than silently becoming unbounded.

### 2. Replace process-local watcher timers

Remove indefinite `setTimeout`/Map-based watcher loops from API modules.

Implement bounded request-driven playback refresh:

- A server-only `refreshPlaybackState(eventId, userId, reason)` service.
- Redis distributed lock/debounce so only one instance refreshes a given event during the minimum interval.
- Admin and display clients request refresh at documented adaptive intervals while those screens are active.
- Store a short-lived shared playback snapshot with `fetchedAt`, provider status and stale/degraded flags.
- Broadcast Pusher updates only when the normalised state changes.
- Never claim real-time/current when the snapshot is stale.

If a durable worker platform is already available and clearly more reliable, it may be used, but no long-running timer may live in a Vercel route process.

### 3. Make guest submission idempotent and fair

- Issue/maintain an event-scoped guest session/device identifier in a secure cookie.
- Rate-limit primarily by `event + guest session`, with IP hash as a secondary abuse signal.
- Add a client-generated UUID idempotency key for request submission.
- Store a unique event/idempotency constraint and return the original result on retry.
- Perform duplicate-track policy and insertion in one transaction or protected database operation.
- Define when the same track may be requested again, for example after played/rejected or after a configurable cooldown.
- Do not let all guests behind one NAT share a single small quota.

### 4. Make approval/queue actions concurrency-safe

Define explicit request states such as:

- `pending`
- `approving`
- `approved`
- `rejected`
- `played`
- `queue_failed`

Approval flow:

1. Atomically claim `pending -> approving` for the exact event/tenant.
2. If claim fails, return the current request state and do not call Spotify.
3. Perform the provider queue action with a durable operation/idempotency record.
4. Transition to `approved` on success.
5. Transition to `queue_failed` with a retry-safe error category on failure.
6. Ensure retries do not add a second copy when the first provider call succeeded but the response was lost. Use a provider operation ledger and reconciliation where the Spotify API cannot supply an idempotency key.

Document unavoidable Spotify queue limitations honestly.

### 5. Introduce event-scoped archive and retention

- Every request belongs to a specific event, not only a user.
- Ending an event sets lifecycle timestamps and freezes/archives its active request set.
- Logout never deletes requests.
- Create an event summary query with counts, most-requested artists/tracks, approval/rejection/played totals and operational incidents.
- Define retention defaults and deletion/anonymisation jobs aligned with privacy documentation.
- Preserve requester nickname only for the documented retention period.
- Add an organiser action to permanently delete archived event data, with confirmation and audit trail, if required by policy.

### 6. Unify event state

After PRD-05's canonical schema:

- Use one event lifecycle source for status, request/display enabled state, access policy and start/end timestamps.
- Remove dual writes that can drift.
- Use optimistic concurrency/version numbers for organiser state changes.
- Pusher events and clients carry the event version so stale updates can be ignored.

### 7. Make degraded states explicit

Define typed service states such as:

- `healthy`
- `stale`
- `provider_disconnected`
- `no_active_device`
- `rate_limited`
- `provider_unavailable`
- `realtime_unavailable`

Admin and display UI must show the correct state. Do not return `success: true` for an operation that changed only local UI state or an in-memory copy.

### 8. Correct queue reorder capability

Until PRD-07 provides an app-owned provider queue:

- Remove or disable the reorder control when the active provider cannot guarantee reorder.
- Make the API return a typed `CAPABILITY_NOT_SUPPORTED` result rather than false success.
- Preserve ordering only for PartyPlaylist's own pending/approved request list, clearly labelled as request priority rather than Spotify queue order.

### 9. Load and fault testing

Create scripts/tests modelling:

- 150 guests behind one public IP with unique guest sessions.
- Simultaneous duplicate submissions.
- Double-click/concurrent approval across two server instances.
- Redis outage.
- Spotify 401 refresh, 403 development-mode denial, 429, no active device and timeout after uncertain queue success.
- Pusher outage with polling fallback.
- Server redeploy while display and admin are open.

## Acceptance criteria

- No correctness/security mechanism relies solely on a process-local Map or timer.
- Playback refresh works across instances with shared lock/cache and visible staleness.
- Guest requests are idempotent and fairly limited behind shared NAT.
- Concurrent approval cannot intentionally queue the same request twice.
- Event end archives history; logout never deletes it.
- One canonical event lifecycle drives organiser, guest and display state.
- Unsupported queue reorder is no longer reported as successful.
- Load and fault tests pass at the advertised beta guest limit.

## Non-goals

- Building a full DJ mixing engine
- Guaranteeing Spotify queue idempotency beyond what the provider exposes; document and mitigate uncertainty
- Payments - PRD-09
