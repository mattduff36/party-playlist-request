# PRD-04: Tenant, Guest, Display and Realtime Isolation


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
git switch -c dev/prd-04-tenant-realtime-isolation-<YYYYMMDD>
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

- Priority: P0/P1 security
- Depends on: PRD-02 and PRD-03 merged
- Primary references: SEC-03, SEC-07, SEC-10, SEC-15, SEC-16 and COR-05

## Objective

Ensure every realtime subscription, guest request, display read and tenant-scoped API proves access to the exact event or account being accessed. Pusher must deliver updates, not act as an accidental public data feed.

## Current verified problems

- `/api/pusher/auth` authorises arbitrary `private-*` channels without checking organiser, guest or display ownership.
- Presence identity is hard-coded.
- Legacy display routes bypass access-code/event controls.
- Notification records and some helper functions can be used without strict tenant scope.
- Display-token usage is checked and decremented in separate operations.
- Some event codes and one-time tokens are recoverable values rather than one-way protected values.

## Required outcomes

### 1. Define an explicit channel contract

Replace free-form channel names with a small documented set. Recommended pattern:

- `private-user-{userId}-admin`
- `private-event-{eventId}-guest`
- `private-event-{eventId}-display`

If the current broadcaster requires additional channels, document each exact pattern, permitted event types and permitted subscribers. Unknown patterns must be rejected.

Do not put usernames, access codes, email addresses, nicknames, Spotify tokens or other secrets in channel names or payloads.

### 2. Authorise Pusher subscriptions by channel type

For admin channels:

- Require the authoritative current admin session from PRD-02.
- Parsed channel `userId` must match the authenticated user, except a deliberately audited super-admin support action.

For guest channels:

- Require a valid event-scoped guest session cookie issued after access-code verification or open-event entry.
- Verify the guest session belongs to the channel event and has not expired/revoked.

For display channels:

- Require a valid display session/token scoped to the event and display purpose.
- Do not allow a guest cookie to subscribe to admin or display channels.

For presence channels, use a random scoped member ID and minimal metadata. Never hard-code all users as the same member.

Pusher configuration missing in production must fail closed. Mock/test mode must be explicit.

### 3. Make event access a reusable policy service

Create one typed event-access service used by request, display, public status and Pusher auth routes. It should resolve:

- Event identity and lifecycle state
- Whether requests/display are enabled
- Access-code requirement and verification state
- Guest/display session validity
- Event expiry/end state
- Requested capability: submit, read request status, display read, public limited status

Do not duplicate slightly different access decisions across routes.

### 4. Replace username-only reads

- Remove any remaining route that returns playback, queue, request history or nicknames from only a username.
- Modern public routes must require event identity plus the appropriate guest/display proof.
- Public event-status responses may reveal only the minimum needed to render an entry page. Do not expose request lists, requester identity, admin settings or provider state before access is granted.
- Ensure search and request submission resolve the same active event and cannot infer another tenant's event by changing URL values.

### 5. Enforce tenant scope in repositories

- Remove optional `userId`/tenant arguments from request read/update helpers used by organiser routes.
- Require an explicit tenant/event context at function boundaries.
- Make unscoped helper names impossible or clearly internal to a super-admin-only repository.
- Replace dynamic update field names with an allowlisted field map.
- Add assertions that request ID and event/user scope match in the same query, not in separate trust steps.

### 6. Atomic display-token use

- Verify expiry, purpose, event and remaining-use count in one atomic database operation.
- Use `UPDATE ... WHERE uses_remaining > 0 ... RETURNING` or a transaction with row lock.
- Concurrent attempts must not exceed the allowed count.
- Hash stored display tokens. Store only a token prefix/fingerprint for support diagnostics.
- Rotate/revoke tokens when an event ends or organiser requests it.

### 7. Protect access and one-time codes

- Store password-reset and email-verification tokens as one-way hashes.
- Store event access codes as a keyed HMAC when the organiser may need to re-display the original code, or a password hash when redisplay is unnecessary.
- Use constant-time verification.
- Add expiry, attempt throttling and revocation.
- Never log full codes or tokens.

### 8. Minimise realtime payloads

- Publish stable IDs and display-safe fields only.
- Do not publish email, internal user ID unless needed for routing, requester network identifier, access code, raw Spotify response or audit internals.
- Treat every Pusher event as potentially observable by an authorised guest/display for that event.

## Tests

Create a security matrix covering at least two organisers, two events, guests and displays. Prove:

- Organiser A cannot subscribe to Organiser B's admin/event channels.
- Guest A cannot subscribe to Event B or any admin/display channel.
- Display A cannot access Event B.
- Unknown/malformed channel names are rejected.
- Protected event data cannot be fetched by username alone.
- Closed/expired event guest sessions stop working.
- Concurrent single-use display token attempts produce exactly one success.
- Request update helpers cannot operate without event/tenant context.
- Arbitrary update column input is rejected before SQL generation.
- Reset/access token database values cannot be used directly as bearer values.
- Realtime payload snapshots contain no banned sensitive fields.

## Acceptance criteria

- Pusher private channels enforce exact organiser, guest or display ownership.
- One reusable event-access policy controls public/guest/display routes.
- No username-only route exposes protected event information.
- Tenant context is mandatory in organiser request repositories.
- Display-token use is atomic and stored tokens are one-way protected.
- One-time tokens and access codes follow documented hashing/HMAC rules.
- Cross-tenant regression tests pass.

## Non-goals

- New co-host role model
- Full event table consolidation and distributed watcher architecture - PRD-05 and PRD-06
