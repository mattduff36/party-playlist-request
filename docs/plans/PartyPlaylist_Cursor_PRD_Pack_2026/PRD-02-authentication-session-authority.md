# PRD-02: Authoritative Authentication, Session Revocation and Request Protection


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
git switch -c dev/prd-02-auth-session-authority-<YYYYMMDD>
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
- Depends on: PRD-01 merged
- Primary references: SEC-04, SEC-05, SEC-09, SEC-14 and current single-active-session behaviour

## Objective

Make the server, not the browser, authoritative about whether an organiser session is still active. A transferred, revoked or logged-out session must immediately lose access and must not be able to refresh itself, end an event or delete data. Add consistent protection for cookie-authenticated mutations.

## Current verified problems

- `requireAuth` verifies JWT signature and expiry but does not compare `session_id` with `users.active_session_id`.
- A transferred-out JWT can remain valid for up to seven days and can call `/api/auth/refresh-session`.
- Logout clears the account's active session, takes the event offline and deletes all requests using only a signed JWT.
- Authentication and password flows lack a shared production rate limiter.
- Sensitive cookie-authenticated mutations do not consistently validate origin or CSRF proof.

## Required outcomes

### 1. Introduce an asynchronous authoritative admin guard

Create a single server-side authentication module for protected route handlers. It must:

- Verify the JWT signature, expiry, issuer/audience if configured and required claims.
- Load the current user/session record from the canonical current database layer.
- Compare token `session_id` with the account's active session identifier using exact equality.
- Reject disabled, deleted, unverified or non-active accounts according to existing product rules.
- Return a typed authenticated context containing `userId`, `username`, `role`, `sessionId` and request correlation ID.
- Return generic `401`/`403` responses without leaking account state.
- Support explicit super-admin checks without bypassing active-session validation.
- Be usable as a wrapper for route handlers so tenant context cannot be forgotten.

A short-lived server cache may reduce reads only if revocation remains effectively immediate. Do not cache active-session authority in a process-local Map.

### 2. Apply the guard consistently

Audit and convert all sensitive routes, including:

- `/api/admin/**`
- `/api/superadmin/**`
- organiser-facing Spotify mutation/status routes
- monitoring/support routes
- `/api/auth/me`
- `/api/auth/refresh-session`
- session transfer and logout

Routes intended for guests or displays must use guest/display authorization from PRD-04, not the admin guard.

### 3. Correct session transfer and refresh

- Transfer must atomically replace the active session identifier.
- The old session must fail its next protected request immediately.
- Refresh must first pass authoritative active-session validation, then issue a new token carrying the same active session ID.
- Do not return JWTs in JSON unless a documented non-cookie client genuinely requires them. Prefer HttpOnly cookies.
- Rotate session IDs after password reset, email change, privilege change and any suspected compromise.
- Add a clear client response code such as `SESSION_REVOKED` so the UI can show the existing transfer/session message and clear local state.

### 4. Separate logout, session release and event termination

Implement distinct actions:

- **Logout this browser:** clear only this browser's cookie. If its session ID is still active, release only that active session lock. Do not change event status and do not delete requests.
- **End event:** an explicit authenticated organiser action with UI confirmation. Move the event to an ended/offline lifecycle state and close guest/display access according to settings. Archive data rather than deleting it.
- **Clear event data:** not part of logout or end-event. Any future destructive cleanup must be a separate, strongly confirmed and audited action.

Use conditional updates such as `WHERE id = ? AND active_session_id = ?` so an old session cannot clear a new session.

### 5. Add CSRF and same-origin protection

For cookie-authenticated state-changing requests:

- Implement same-origin validation using an allowlisted application origin.
- Add a double-submit CSRF token or an equivalent robust framework-compatible mechanism.
- Issue the CSRF value securely and require it in a custom request header for `POST`, `PUT`, `PATCH` and `DELETE` admin actions.
- Update all organiser and super-admin fetch helpers centrally rather than patching components inconsistently.
- Exempt OAuth provider callbacks and public guest submission only where they use separate anti-forgery controls.
- Validate `Content-Type` and reject cross-site form fallbacks.

### 6. Add distributed authentication throttling

Use the project's Upstash Redis support or another shared store. Protect:

- Login
- Registration
- Username/email lookup used by authentication
- Session transfer
- Forgot password
- Reset password
- Email verification resend

Requirements:

- Combine per-IP and per-account/email-hash buckets.
- Use progressive delays or temporary lock windows after repeated failures.
- Return generic responses that do not confirm whether an account exists.
- Use a mandatory versioned HMAC/salt for stored limiter identifiers.
- In production, do not silently fall back to unbounded access when Redis configuration is missing. Fail startup or use an explicitly documented safe degraded policy.
- Keep test/dev configuration deterministic.

### 7. Security event audit trail

Create a minimal structured audit event for:

- Login success/failure category
- Session transfer
- Session revoked response
- Password reset completion
- Super-admin access
- Event end

Do not store passwords, tokens, codes, full IP addresses or sensitive request bodies. Include correlation ID, user/event ID where known, timestamp and event type.

## Tests

Add unit, API and E2E coverage for:

- Old session rejected immediately after transfer.
- Old session cannot refresh, logout the new session, end the event or call admin APIs.
- Conditional logout does not clear a newer active session.
- Logout never changes event status or request rows.
- End-event is explicit, authorised and non-destructive.
- Normal organiser cannot access super-admin endpoints.
- Missing, stale, malformed and revoked JWTs return the correct generic response.
- Cross-origin mutation and missing/incorrect CSRF token are rejected.
- Valid same-origin mutation with CSRF token succeeds.
- Rate limits work across separate application instances using the shared test store.
- Forgot-password responses do not reveal account existence.

## Acceptance criteria

- Every protected organiser/super-admin route uses the authoritative async guard.
- Session transfer/revocation takes effect on the next request.
- Refresh cannot extend a stale session.
- Logout only logs out the current browser/session and never destroys event data.
- End-event is a distinct action with audit logging.
- Cookie-authenticated mutations enforce same-origin and CSRF protection.
- Authentication/reset endpoints use distributed throttling.
- UI handles `SESSION_REVOKED` cleanly without infinite refresh loops.

## Non-goals

- Replacing the current single-active-admin product model with co-host roles
- Full database consolidation - PRD-05
- Guest/display authorization - PRD-04
- Stripe or paid entitlements - PRD-09
