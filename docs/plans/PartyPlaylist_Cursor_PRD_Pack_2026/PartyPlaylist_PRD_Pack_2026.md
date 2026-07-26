---
title: PartyPlaylist Implementation PRD Pack
subtitle: Prepared for Cursor using Grok 4.5 High Fast
date: 26 July 2026
---

# How to use this pack

This staged implementation pack was prepared from `PartyPlaylist_Product_Plan_2026.docx`, `PartyPlaylist_Codebase_Review_2026.docx` and the PartyPlaylist 2.1.26 source archive reviewed on 26 July 2026.

The project already contains a substantial product. Urgent security defects and conflicting infrastructure make one large implementation prompt unsafe. Complete, test and review one PRD before starting the next.

## Recommended order

1. **PRD-01: Production Lockdown and Immediate Attack-Surface Reduction**
2. **PRD-02: Authoritative Authentication, Session Revocation and Request Protection**
3. **PRD-03: Spotify OAuth, PKCE and Stored Credential Security**
4. **PRD-04: Tenant, Guest, Display and Realtime Isolation**
5. **PRD-05: Canonical Database Architecture, Migrations and Trustworthy Quality Gates**
6. **PRD-06: Distributed Reliability, Concurrency Safety and Event Data Integrity**
7. **PRD-07: Playback Provider Abstraction and Spotify-Independent Manual Mode**
8. **PRD-08: Paid Beta Product Readiness, Event Setup and Customer Deliverables**
9. **PRD-09: £19.99 Party Pass Payments, Entitlements and Commercial Launch Controls**


## Branching and review model

Every PRD requires a new development branch before source changes begin. Normally, merge and review the previous PRD before creating the next branch from the accepted default branch.

Use `CURSOR_MASTER_INSTRUCTIONS.md` together with one PRD. Review the diff, migrations and test results before merging. Do not create one long implementation branch unless Matt explicitly changes this workflow.

## Global release gates

- Complete and independently review PRD-01 through PRD-06 before paid public access.
- Obtain a written Spotify commercial/quota route, or ensure manual mode can fulfil the advertised product without promising Spotify playback.
- Make type-check, lint, unit, API, production build and smoke E2E blocking CI checks.
- Create a clean database solely from the canonical migrations.
- Observe a real beta event covering network loss, Spotify expiry, no active device, display reconnect and session transfer.
- Complete privacy, terms, retention, refund and music-responsibility wording.

# Master Cursor instructions

Use this file together with exactly one PRD from this pack.

## Role

Act as the senior TypeScript, Next.js, PostgreSQL and application-security engineer responsible for implementing the supplied PRD in the existing PartyPlaylist repository.

## Behaviour

- This is a coding task. Do not transform the PRD into another prompt.
- Read repository rules, but this PRD pack takes precedence where generic prompt-optimiser behaviour conflicts with direct implementation.
- Inspect the actual source before deciding a file is safe to remove or modify.
- Do not ask broad planning questions. Make a reasoned implementation choice inside the stated constraints. Ask only when a missing credential, inaccessible service or irreversible production decision makes implementation impossible.
- Show concise progress summaries while working.
- Do not claim tests passed unless they were run and passed.
- When an existing test encodes insecure or obsolete behaviour, update the test and explain why.

## Required lifecycle

1. Create the PRD-specific development branch before editing.
2. Establish a baseline with the relevant lint, type-check, tests and build commands.
3. Implement in small coherent steps.
4. Add security and regression tests.
5. Run the PRD verification commands.
6. Review the final diff for secrets, logging, tenant leakage and accidental unrelated edits.
7. Commit locally.
8. Produce the required completion report and stop. Do not push.

## Source precedence

1. The current PRD
2. Current source and database migrations
3. `PartyPlaylist_Codebase_Review_2026.docx`
4. `PartyPlaylist_Product_Plan_2026.docx`
5. Historical repository documentation

Historical documents contain claims that no longer match the July 2026 source. Never mark a finding resolved solely because an old document says it was fixed.


# PRD-01: Production Lockdown and Immediate Attack-Surface Reduction


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
git switch -c dev/prd-01-production-lockdown-<YYYYMMDD>
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

- Priority: P0 - first security build
- Depends on: none
- Recommended merge requirement: independent review before PRD-02
- Primary references: Codebase Review findings SEC-01, SEC-02, SEC-07, SEC-10, SEC-11, SEC-12 and PERF-02

## Objective

Remove or fail-close the routes and fallbacks that allow unauthenticated database changes, public operational control, cross-event data access or excessive telemetry. This PRD is an emergency containment build. It should reduce risk without attempting the full database or worker redesign covered later.

## Current verified problems

- `src/app/api/create-schema/route.ts`, `src/app/api/init-db/route.ts` and `src/app/api/migrate/user-settings/route.ts` can execute schema or data changes without authentication.
- `src/app/api/startup/route.ts` publicly starts a process-local Spotify watcher.
- `src/app/api/admin/spotify-watcher/route.ts` accepts a hard-coded `startup-system-token` and uses substring matching. An absent environment variable can make an arbitrary Authorization header match.
- `src/components/ServerStartup.tsx` calls the public startup route from a browser.
- Legacy display routes expose event data by username without enforcing current event access controls.
- The global notification API is not tenant-scoped.
- Detailed monitoring and client-error routes disclose or accept more operational data than a public endpoint needs.

## Required outcomes

### 1. Remove runtime database administration from public routes

- Delete the public route handlers for schema creation, database initialisation and ad-hoc user-settings migration.
- Remove all application code, browser code, tests and documentation that call those endpoints.
- Preserve required SQL as versioned migration source material, but do not leave an HTTP trigger.
- Return `404` by deleting the route, rather than a friendly unauthenticated status page.
- Ensure production schema changes can only be run through a command or deployment migration process. PRD-05 will establish the final migration architecture.

Target routes:

- `src/app/api/create-schema/route.ts`
- `src/app/api/init-db/route.ts`
- `src/app/api/migrate/user-settings/route.ts`

### 2. Eliminate the browser-triggered startup mechanism

- Remove `src/app/api/startup/route.ts` and `src/components/ServerStartup.tsx`.
- Remove the component from layouts or providers.
- Remove `SYSTEM_STARTUP_TOKEN` and the literal fallback from code and documentation unless another strictly internal non-HTTP use remains.
- Do not replace this with another publicly callable startup route.

### 3. Make Spotify refresh calls bounded and authenticated

The final watcher/worker design belongs to PRD-06. For this lockdown build:

- Remove the system-token path from `/api/admin/spotify-watcher`.
- Remove `start`, `stop` and global `status` actions that operate process-wide timers.
- Keep only bounded one-shot actions required by current organiser UX, such as `check` or `refresh-queue`.
- Require the authenticated organiser and derive `userId` from the authoritative request identity. Never accept a caller-supplied user ID.
- Extract reusable one-shot refresh logic into a server-only service and call it directly from server routes. Do not make one route call another route with a secret header.
- Update `approve/[id]`, event controls and admin data code so they no longer rely on the removed startup/global watcher actions.
- In production, missing Pusher or required Spotify configuration must fail closed or enter an explicit degraded state. Do not silently authorise or start fallback behaviour.

### 4. Disable legacy unprotected data routes

Where modern protected replacements already exist, remove the legacy routes and update callers/tests:

- `src/app/api/display/current/route.ts`
- `src/app/api/display/requests/route.ts`

Use the current event/display-token/guest-access APIs instead. If a caller cannot be migrated safely in this PRD, make the legacy route return `410 Gone` with no event data and record the caller for PRD-04.

### 5. Remove or secure global notifications

- Determine whether `/api/notifications` is still used.
- If obsolete, remove the route, table usage and client code.
- If actively required, require authenticated current-session admin access and scope every read/update by `user_id` or `event_id`.
- Never permit a caller to mark an arbitrary notification ID as shown without proving ownership.

### 6. Minimise public monitoring output

- Keep one public liveness endpoint only if deployment infrastructure requires it.
- Public liveness must return a small response such as `{ "status": "ok" }` and must not expose database details, dependency timings, environment values, memory history, user data or stack traces.
- Require super-admin current-session authentication for detailed health, metrics, dashboard and error-history routes.
- Ensure raw errors are logged through a redacted server logger and are not returned to public callers.

### 7. Bound public client-error ingestion

For any public client-error endpoint retained in this build:

- Enforce a small JSON body limit.
- Validate allowed fields and maximum lengths.
- Drop caller-supplied stack traces or heavily truncate and redact them.
- Reject non-JSON and unexpected fields.
- Add a temporary per-process development limiter only if needed immediately, but mark distributed limiting as a PRD-02/PRD-06 dependency.
- Never persist cookies, Authorization headers, access codes, OAuth values, URLs with sensitive query strings or raw user-entered secrets.

## Tests

Add regression tests proving:

- Removed schema/startup routes return `404` and cannot alter a test database.
- Watcher requests without a valid organiser cookie return `401`.
- A literal `startup-system-token` and arbitrary bearer header are rejected.
- One organiser cannot trigger a refresh for another organiser.
- Legacy display routes return no event data.
- Detailed monitoring endpoints reject anonymous and normal-organiser requests.
- Public liveness output contains only the approved minimal shape.
- Notification mutation cannot affect another tenant.
- Oversized or malformed client-error payloads are rejected.

## Verification commands

At minimum run:

```bash
npm ci
npm run type-check
npm run lint
npm run test:unit
npm run test:api
npm run build
```

If baseline type/lint failures unrelated to this PRD prevent completion, document them precisely. Do not restore `ignoreBuildErrors` or `ignoreDuringBuilds`; PRD-05 owns the complete quality-gate clean-up.

## Acceptance criteria

- No unauthenticated HTTP endpoint can execute DDL, migrations or startup tasks.
- No hard-coded startup token or substring secret comparison remains.
- No browser component starts server background work.
- Spotify refresh endpoints are bounded, organiser-authenticated and tenant-scoped.
- Legacy display endpoints expose no data.
- Detailed operational telemetry is protected by super-admin authentication.
- Public error intake has validation and limits.
- Tests cover every removed or restricted route.
- Existing organiser, guest and display journeys still load using supported APIs.

## Non-goals

- Full authoritative active-session enforcement - PRD-02
- OAuth/token encryption - PRD-03
- Complete Pusher and guest-channel authorisation - PRD-04
- Canonical database migration system - PRD-05
- Durable distributed Spotify watcher - PRD-06



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



# PRD-03: Spotify OAuth, PKCE and Stored Credential Security


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
git switch -c dev/prd-03-spotify-oauth-token-security-<YYYYMMDD>
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
- Depends on: PRD-02 merged
- Primary references: SEC-06, SEC-08, SEC-17 and the Product Plan's Spotify decision gate

## Objective

Make Spotify authorisation server-owned, user-bound, single-use and auditable. Stop exposing PKCE verifier material, stop accepting client-supplied verifiers and stop writing Spotify access/refresh tokens as plaintext.

## Current verified problems

- `/api/spotify/oauth-session` returns the PKCE `code_verifier` to a caller who knows the state.
- The callback flow redirects the Spotify code/state to a browser page, then accepts a client-supplied verifier in a POST.
- State is not atomically consumed while proving it belongs to the current authenticated user.
- Spotify tokens are stored in plaintext database columns.
- Debug logs include token-save detail, code/verifier prefixes, user identifiers and verbose Spotify errors.

## Required outcomes

### 1. Replace the OAuth session model

Store an OAuth transaction server-side with at least:

- Random state hash or HMAC
- User ID
- PKCE verifier ciphertext or server-only protected value
- Created and expiry timestamps
- Intended post-callback redirect identifier from a strict allowlist
- Single-use/consumed state

Requirements:

- State must use cryptographically secure randomness.
- Store only a hash/HMAC of state where practical. The raw state travels in the OAuth request and cookie/session binding.
- Expire transactions quickly, normally 10 minutes or less.
- Starting a new Spotify connection invalidates previous unconsumed transactions for the same user.
- Do not expose the verifier through any API response or client bundle.

### 2. Complete token exchange in the server callback

Refactor the Spotify callback so the server:

1. Receives `code`, `state` or provider error.
2. Validates the active organiser session from PRD-02.
3. Atomically loads and consumes the matching OAuth transaction.
4. Proves transaction `user_id` equals the authenticated user.
5. Exchanges the code using the stored PKCE verifier.
6. Encrypts and stores the tokens.
7. Deletes/invalidates the OAuth transaction.
8. Redirects to a fixed organiser Spotify result page with only a success/error code, never tokens or OAuth secrets.

Remove `/api/spotify/oauth-session`. Remove client POST exchange logic and client-supplied `code_verifier`.

If the Spotify redirect can legitimately lose the organiser cookie in a supported deployment, use a separate signed, HttpOnly, short-lived OAuth binding cookie. Do not weaken user binding.

### 3. Implement a versioned token vault

Create a server-only token-encryption service using authenticated encryption, preferably AES-256-GCM with a 32-byte environment key or a managed KMS/envelope design.

Minimum envelope data:

- Ciphertext
- IV/nonce
- Authentication tag
- Key version
- Algorithm/version marker

Requirements:

- `TOKEN_ENCRYPTION_KEY_V1` or equivalent must be mandatory in production.
- Validate key length and format at startup.
- Use separate random nonces for every encryption.
- Bind ciphertext to user/provider/token type through authenticated additional data.
- Never log plaintext, key material, ciphertext payloads or decrypted prefixes.
- Decrypt only inside the Spotify service immediately before use.
- Design for key rotation with multiple read keys and one active write key.

### 4. Migrate existing plaintext tokens safely

Create a staged migration, not an irreversible one-step change:

- Add encrypted token envelope columns or a new provider-credentials table.
- New writes use encryption only.
- A non-production migration command converts existing tokens and verifies decryption.
- Production migration requires backup and an explicit operator command.
- During a short transition, allow read-old/write-new only behind a migration flag.
- After verification, remove plaintext values and then remove plaintext columns in a separate migration.
- Never include real tokens in migration logs.

Document exact rollback boundaries. A rollback must not require printing decrypted tokens.

### 5. Tighten token lifecycle

- Refresh tokens through the token vault and replace them when Spotify rotates them.
- Use database locking or compare-and-swap to prevent two simultaneous refreshes overwriting each other.
- On disconnect, remove access token, refresh token, provider profile data, caches and outstanding OAuth transactions for that user.
- On account deletion, remove provider credentials.
- Return an explicit connection status without exposing scopes or provider identity data unnecessarily.
- Ensure all Spotify API errors are mapped to typed internal categories such as expired authorisation, development-mode denial, rate limit, no active device and provider outage.

### 6. Logging and validation

- Replace verbose callback/service console logging with structured redacted logs.
- Add request/response schemas for OAuth bodies and Spotify token responses.
- Validate token response shape at runtime before storage.
- Do not return raw provider error bodies or stack traces to the browser.
- Allow only known redirect destinations.

## Tests

Add tests proving:

- OAuth verifier never appears in browser responses, client props or logs.
- State is single-use and expires.
- A user cannot complete another user's OAuth transaction.
- Callback without an active current session fails safely.
- Concurrent callbacks cannot consume the same state twice.
- Stored database values do not contain known plaintext test tokens.
- Tampered ciphertext, IV, tag or additional data fails decryption.
- Key-version rotation reads old ciphertext and writes new-version ciphertext.
- Concurrent refresh does not corrupt the latest refresh token.
- Disconnect deletes provider credentials and invalidates cache/session data.
- Logs and API responses do not contain token/code/verifier fixtures.

## Acceptance criteria

- `/api/spotify/oauth-session` no longer exists.
- No client supplies or receives a PKCE verifier.
- OAuth state is atomically consumed and bound to the current authenticated user.
- New Spotify token writes are encrypted with authenticated, versioned encryption.
- A documented migration path exists for existing plaintext rows.
- Disconnect and account deletion remove Spotify personal data.
- Spotify errors are typed, redacted and user-safe.
- All tests pass without placing encryption keys in source control.

## Non-goals

- Proving Spotify commercial approval or quota suitability
- Durable watcher redesign - PRD-06
- Provider abstraction/manual mode - PRD-07



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



# PRD-05: Canonical Database Architecture, Migrations and Trustworthy Quality Gates


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
git switch -c dev/prd-05-canonical-database-ci-<YYYYMMDD>
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

- Priority: P1 architecture and delivery
- Depends on: PRD-01 through PRD-04 merged
- Primary references: COR-01 through COR-06, PERF-01, PERF-05 and Codebase Review testing recommendations

## Objective

Create one authoritative PostgreSQL model, one runtime connection strategy, one versioned migration path and a build pipeline that fails on real defects. Remove conflicting Drizzle/raw/neon schemas and request-time DDL without attempting an unnecessary full application rewrite.

## Architectural decision

For this project stage, standardise runtime data access on `pg` with a central pool and typed repository/service modules. Use one explicit versioned SQL migration runner. Remove the incomplete parallel Drizzle model once no active import depends on it.

Reason: the majority of working application behaviour already uses raw PostgreSQL helpers. Converting the entire product to a new ORM while fixing security would add migration risk without immediate customer value.

Cursor may propose a different final library only if it demonstrates lower migration risk and updates this decision record in the PRD completion report. It must still result in one schema and one migration system.

## Current verified problems

- `src/lib/db.ts` represents the live raw-SQL schema while `src/lib/db/schema.ts` and `src/lib/db/index.ts` define a conflicting Drizzle model.
- Tables/columns differ, including `admins` vs `users`, `spotify_tokens` vs `spotify_auth` and incompatible request/event structures.
- Imports such as `dbService` from `@/lib/db` do not match the actual module exports.
- `/api/events/poll` uses fields that do not exist in the current schema.
- Database initialisation/ALTER statements run in request paths through `initializeDefaults`/`initializeDatabase`.
- Multiple top-level pools can multiply serverless connections.
- `next.config.ts` ignores TypeScript and ESLint build failures.

## Required outcomes

### 1. Capture and validate the canonical schema

- Inspect production-like migration SQL and live-code queries.
- Produce `docs/database/canonical-schema.md` describing tables, columns, keys, indexes, ownership and lifecycle.
- Choose one canonical event model. Remove the split between core events and guest-facing `user_events`, or create a temporary compatibility view with a dated removal plan.
- Every song request must belong to an explicit event and organiser/account.
- Define foreign keys and delete behaviours intentionally.
- Include schema versioning and migration history table.

### 2. Establish versioned migrations

- Create ordered, immutable migration files with `up` and safe rollback/forward-fix instructions.
- A clean empty PostgreSQL database must be creatable using only the migration command.
- Existing installations must be migratable without request-time DDL.
- Migrations must be transactional where PostgreSQL permits.
- Add dry-run/validation documentation and production backup requirements.
- Remove ad-hoc SQL route migration instructions from current docs.

### 3. Centralise database connectivity

- Create one server-only pool/client module.
- All runtime database calls use it or typed repositories built on it.
- Configure conservative serverless connection limits and timeouts.
- Remove route-level/top-level duplicate pools and direct Neon clients unless a documented exceptional use remains.
- Add graceful shutdown for scripts/tests where applicable.
- Never expose a database client to client components.

### 4. Split the monolithic database helper safely

Create typed repositories by domain, for example:

- `usersRepository`
- `sessionsRepository`
- `eventsRepository`
- `requestsRepository`
- `spotifyCredentialsRepository`
- `settingsRepository`
- `auditRepository`

Requirements:

- Explicit tenant/event context in method signatures.
- Parameterised values and allowlisted update fields.
- Typed row-to-domain mapping.
- Transactions passed explicitly for multi-step operations.
- No DDL inside repositories.
- Keep a temporary compatibility export only when needed to avoid a giant unreviewable diff. Mark it deprecated and remove dead functions.

### 5. Remove conflicting/dead data paths

- Fix or remove `/api/events/poll` and `src/lib/state/global-event.tsx` if not used.
- Remove broken `db`/`dbService` imports.
- Delete the incompatible Drizzle schema/index layer and related commands/dependencies when no longer used.
- Remove duplicate migration sets and historical executable scripts from active production workflows. Archive documentation only if still useful.
- Search for every database table/column string to catch stale code paths.

### 6. Eliminate request-time schema work

- `initializeDefaults` may create missing user settings data using normal `INSERT ... ON CONFLICT`, but it must never create/alter tables or indexes.
- Guest request/search and admin routes must not execute DDL.
- Add a test that spies/blocks DDL during normal API requests.

### 7. Restore build and CI gates

- Remove `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` from `next.config.ts`.
- Fix all TypeScript and ESLint errors rather than suppressing categories globally.
- Add a CI workflow that runs on pull requests:

```bash
npm ci
npm run type-check
npm run lint
npm run test:unit
npm run test:api
npm run build
```

- Add a small Playwright smoke job using an ephemeral test database.
- Add dependency vulnerability scanning and automated update configuration.
- Protect the default branch so failed checks block merging, documenting the required repository setting for Matt.

### 8. Validate environment configuration

- Add a server-side environment schema with clear required/optional variables per environment.
- Fail fast in production when database, JWT, encryption, Pusher, Redis or URL variables required by enabled features are absent.
- Update `.env.example` to match actual Resend, Redis, Spotify, Pusher, encryption, URL and monitoring usage.
- Remove SendGrid/obsolete variables and secrets no longer used.

### 9. Update documentation and naming

- Rewrite README architecture/setup/deployment sections from the running code.
- Standardise product name as `PartyPlaylist` in page titles, emails, docs and package descriptions.
- Remove promises of playlist writes if the product uses Spotify queue operations.
- Add the intended licence file or remove the MIT claim.

## Tests

- Fresh database migration from zero.
- Upgrade migration from a representative pre-PRD schema fixture.
- Rollback or documented forward-fix validation for every new migration.
- Repository tenant-scope tests.
- No DDL during normal API calls.
- No duplicate pools created by importing multiple routes.
- Compile-time tests/type-check for repository DTOs.
- All CI commands pass with no ignored errors.
- E2E smoke: register/login or fixture login, open organiser page, guest entry/request and display page.

## Acceptance criteria

- One canonical schema and migration history exists.
- A blank database is reproducibly created from migrations.
- Normal application requests perform no DDL.
- One central connection strategy is used.
- Conflicting Drizzle/legacy database imports are removed.
- TypeScript and ESLint failures block the production build and CI.
- Full CI pipeline passes.
- README and `.env.example` match the implementation.

## Non-goals

- Large UI redesign
- Co-host/roles implementation
- Stripe integration
- Complete distributed watcher redesign - PRD-06



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



# PRD-07: Playback Provider Abstraction and Spotify-Independent Manual Mode


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
git switch -c dev/prd-07-playback-provider-manual-mode-<YYYYMMDD>
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

- Priority: P1 strategic risk reduction
- Depends on: PRD-06 merged
- Primary reference: Product Plan playback-adapter and non-Spotify fallback recommendations

## Objective

Separate PartyPlaylist's core guest-request/moderation product from Spotify-specific playback. Deliver a useful request-only/manual mode that can run an event without connecting Spotify, while keeping the existing Spotify experience through a provider adapter.

## Product rationale

Spotify quota and commercial-policy suitability remain external decision gates. PartyPlaylist should retain value as a moderated event request system, display and organiser workflow even when provider playback is unavailable or not authorised.

## Required outcomes

### 1. Introduce a provider capability contract

Create a typed server-only interface similar to:

```ts
interface PlaybackProvider {
  readonly id: string;
  getCapabilities(): PlaybackCapabilities;
  getConnectionStatus(context: EventPlaybackContext): Promise<ConnectionStatus>;
  searchTracks?(query: string, context: EventPlaybackContext): Promise<TrackSearchResult[]>;
  getPlaybackState?(context: EventPlaybackContext): Promise<PlaybackSnapshot>;
  addToQueue?(track: ProviderTrack, context: EventPlaybackContext): Promise<QueueOperationResult>;
  pause?(context: EventPlaybackContext): Promise<OperationResult>;
  resume?(context: EventPlaybackContext): Promise<OperationResult>;
  skip?(context: EventPlaybackContext): Promise<OperationResult>;
  setVolume?(value: number, context: EventPlaybackContext): Promise<OperationResult>;
}
```

Use interfaces for shared data, matching project conventions. Actual names may differ, but capability checks must be explicit.

### 2. Implement the Spotify adapter

- Move Spotify-specific service calls behind a `SpotifyPlaybackProvider`.
- Route handlers and UI must not assume all providers can search, queue, control volume or read now-playing.
- Preserve token security and refresh behaviour from PRD-03.
- Map Spotify errors into provider-neutral error categories.
- Include capability flags for queue add, playback controls, now-playing and device selection.

### 3. Implement manual/request-only mode

An organiser can choose `Manual request mode` without Spotify.

Guest experience:

- Submit artist and song title as validated text.
- Optional dedication/reason with strict length, profanity and moderation controls.
- Prevent obvious duplicates using normalised artist/title plus event policy.
- See pending/approved/rejected/played status.

Organiser experience:

- Approve/reject and order PartyPlaylist's own request queue.
- Mark a request as playing and played.
- Edit/correct submitted track metadata.
- Search/copy the artist-title text for use in any legitimate playback service/device.
- Set a manual now-playing item and clear it.

Display experience:

- Show manual now-playing, upcoming PartyPlaylist requests, QR code and notices.
- Clearly label manual mode without showing a Spotify logo or implying Spotify control.

### 4. Store provider-neutral track/request data

- Keep common fields such as title, artists, duration, artwork URL and explicit flag in provider-neutral columns/JSON.
- Store provider ID and provider track ID only when present.
- Manual requests must not require a Spotify URI.
- Existing Spotify requests must migrate without losing history.
- Validate remote artwork URLs or proxy them safely; manual mode may use a neutral placeholder.

### 5. Add an app-owned request queue

- PartyPlaylist controls ordering of approved requests independently of the provider's opaque queue.
- Queue reorder applies to this app-owned queue and is truthful.
- For providers that support queue add, define when an item is sent to the provider: immediately on approval or just-in-time when it reaches the top. Prefer just-in-time if it improves control and duplicate recovery.
- Track provider operation state separately from organiser approval state.
- Display must distinguish `up next in PartyPlaylist` from confirmed provider queue when the provider cannot confirm order.

### 6. Event-level provider selection and fallback

- Store selected provider/mode on the event.
- Readiness flow can switch between Spotify and manual mode before the event.
- During an active event, allow a controlled fallback from Spotify to manual mode without losing requests.
- Switching back must not automatically re-queue every approved item.
- Record provider mode changes in the audit log.

### 7. UI and copy rules

- Hide controls not supported by the active provider.
- Never show successful playback-control messages for unsupported actions.
- Use neutral product terms in common UI, with provider branding only in provider-specific connection areas.
- Add a clear `What this mode does` explanation so organisers understand that manual mode does not play music itself.

## Tests

- Contract tests run against Spotify mock and manual provider.
- Event with no Spotify credentials can complete guest request, approval, reorder, manual now-playing and played flow.
- Provider-specific route cannot access another event.
- Switching to manual mode preserves pending/approved request data.
- Unsupported capability returns typed result and hides UI control.
- Existing Spotify event continues to work through the adapter.
- App-owned queue order is persistent and concurrent reorder is version-safe.
- Display reconnect restores manual now-playing and queue.

## Acceptance criteria

- Core request/admin/display code depends on provider interfaces, not direct Spotify calls.
- Manual mode runs a complete request/moderation/display event without Spotify.
- PartyPlaylist queue reorder is real for the app-owned queue.
- Provider capability flags drive routes and UI.
- Switching modes is audited and non-destructive.
- Product copy accurately describes manual mode limitations.

## Non-goals

- Integrating Apple Music, YouTube or another provider in this PRD
- Audio playback, mixing, crossfading or music-file hosting
- Circumventing provider terms or music licensing



# PRD-08: Paid Beta Product Readiness, Event Setup and Customer Deliverables


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
git switch -c dev/prd-08-paid-beta-readiness-<YYYYMMDD>
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

- Priority: P1/P2 product
- Depends on: PRD-01 through PRD-07 merged
- Primary reference: PartyPlaylist Product Plan sections on customer journeys, differentiation, pricing and roadmap

## Objective

Turn the stabilised system into an observed beta-ready event product before adding public payment. Add a guided readiness flow, event assets, retained event history and recovery guidance so the £19.99 offer can sell an event experience rather than a basic shared queue.

## Product scope

Target private adult events where the organiser already has suitable speakers/playback equipment. Position PartyPlaylist as a self-service party music system with organiser control. Do not claim it replaces every professional DJ or solves venue music licensing.

## Required outcomes

### 1. Event model and lifecycle for beta

Support clear lifecycle states:

- `draft`
- `ready`
- `pre_event` where enabled
- `live`
- `paused/degraded` where needed
- `ended`
- `archived`

Rules:

- One organiser account can prepare future events.
- Beta entitlement may limit concurrent live events, but history remains available.
- Start/end timestamps are recorded.
- Guest and display access follow event state and page settings.
- Event history is never tied to browser login/logout.

### 2. Guided event-readiness wizard

Create a resumable wizard with a readiness score/checklist:

1. Name/date/time and optional venue label
2. Choose Spotify or manual request mode
3. If Spotify: connect account, choose/test playback device, verify play/pause/queue permissions
4. Moderation rules: auto-approve, explicit filter, request limits, duplicate policy
5. Guest access: access code/open entry and pre-event requests
6. Display/theme/message setup
7. QR/signage preview
8. End-to-end test request and approval
9. Recovery checklist and final `Ready` confirmation

Do not mark the event ready when required checks fail. Allow explicit organiser override only for non-critical warnings and record it.

### 3. Event-day recovery centre

Provide concise diagnostics and actions for:

- Spotify disconnected/expired
- No active device
- Provider rate limit/outage
- Pusher unavailable
- Display stale/reconnecting
- Internet interruption
- Manual-mode fallback

Include last successful playback refresh, realtime state and event version. Avoid exposing secrets or internal stack traces.

### 4. Printable QR signage

Generate downloadable event assets from the server:

- A4 poster
- A5 sign
- Table card
- 16:9 screen image/PDF

Include:

- Event title
- QR code
- Short join instructions
- Access code only when the organiser explicitly chooses to print it
- PartyPlaylist branding with optional organiser colour/theme

Use real PDF generation, not a screenshot of a web page. Ensure print-safe margins, high-contrast QR and no private/admin URL.

### 5. Event archive and report

After event end, show a report with:

- Submitted, approved, rejected and played totals
- Unique guest-session count, described as approximate
- Most requested tracks/artists
- Peak request period
- Provider interruptions/degraded periods
- Event start/end/duration
- Downloadable CSV of requests and audit actions

Apply retention/anonymisation rules. Do not expose raw IP identifiers.

### 6. Event templates and rules

Provide a small set of neutral adult/private-event templates such as:

- Birthday party
- Anniversary
- House party
- Wedding reception, only if current legal/platform wording permits it
- Blank/custom

Templates initialise settings but do not lock them. Avoid child-targeted templates while platform policy remains unresolved.

Add initial guardrails:

- Must-play list
- Do-not-play track/artist list
- Artist cooldown
- Maximum active requests per guest
- Duplicate/cooldown explanation shown to guests

Implement guardrails transactionally and make organiser overrides auditable.

### 7. Beta access without public payment

Before Stripe:

- Add a super-admin grant for a time-limited beta entitlement.
- Entitlement controls event activation, not account creation or historical read access.
- Store grant source, start/end, status and audit trail.
- Include an interactive demo mode that uses mock tracks and no real Spotify authorisation.
- Do not consume scarce Spotify development users for anonymous demos.

### 8. Legal/product copy placeholders become real pages

Create complete editable pages/records for:

- Privacy notice
- Terms of service
- Cookie information
- Retention/deletion summary
- Refund/cancellation policy placeholder for PRD-09
- Spotify disconnect/data deletion instructions
- Organiser responsibility for equipment, internet, account eligibility and music permissions

The final legal wording requires professional review. Mark review status in admin configuration and do not present unreviewed placeholders as approved legal advice.

### 9. Observed beta checklist

Add a reusable operator checklist for at least three observed events:

- Setup completed before event
- Guest QR entry tested on iOS/Android
- 50+ simulated requests
- Shared-Wi-Fi rate limiting verified
- Session transfer tested
- Display sleep/reconnect tested
- Spotify token expiry/no-device simulation
- Pusher failure/poll fallback
- Manual fallback used
- End-event report reviewed
- Customer feedback recorded

## Tests

- Wizard resume and readiness gate tests.
- Device/provider test failure prevents ready state unless allowed warning.
- QR assets resolve to guest/display URLs only and scan correctly in test decoding.
- Protected access-code event signage follows organiser disclosure choice.
- Event report uses archived event-scoped data.
- Guardrails work under concurrent submissions.
- Beta entitlement activation/expiry is server-enforced.
- Demo mode never reads/writes production Spotify credentials.
- Accessibility checks for organiser wizard and guest entry.

## Acceptance criteria

- A new organiser can configure and test an event without reading technical documentation.
- Event cannot accidentally be marked ready while required playback/access checks fail.
- QR signage is downloadable and print-ready.
- Event end produces retained history and a useful report.
- Manual fallback and recovery guidance work during a simulated outage.
- Beta entitlement is server-enforced and auditable.
- At least one complete scripted beta rehearsal passes before PRD-09.

## Non-goals

- Public card payment
- Multi-location venue subscriptions
- White-label/custom domains
- Full co-host/agency permissions



# PRD-09: £19.99 Party Pass Payments, Entitlements and Commercial Launch Controls


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
git switch -c dev/prd-09-party-pass-payments-<YYYYMMDD>
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

- Priority: P2 commercial launch
- Depends on: PRD-08 merged and all launch gates below satisfied
- Primary reference: Product Plan recommended £19.99 Party Pass and paid-launch checklist

## Hard start gate

Do not implement or enable public checkout until Matt confirms one of these in the PRD build request or environment configuration:

1. Spotify has provided a written route suitable for the intended paid/private-event usage and expected user scale, or
2. PartyPlaylist is marketed and technically capable of fulfilling the purchased service through PRD-07 manual/request-only mode without promising unavailable Spotify functionality.

Also require reviewed privacy, terms, refund/cancellation and organiser-responsibility wording before production enablement. Code may be built behind a disabled feature flag while approvals are pending.

## Objective

Implement a secure one-off Party Pass priced at £19.99. The pass permits one active event and a 30-day usage window beginning when the organiser deliberately activates it, not automatically at account registration or checkout.

## Commercial rules

- Product: `Party Pass`
- Price: £19.99 including/excluding VAT only as determined by the configured business/tax position. Do not guess tax treatment in code copy.
- Purchase can occur in advance.
- Activation starts the 30-day active window.
- Define and display a use-by date for unactivated purchases.
- One pass supports one active event at a time. Event history remains readable after expiry.
- Refund/cancellation logic follows the reviewed policy and UK consumer requirements.
- Do not advertise unlimited guests until load testing supports a declared limit.

## Required outcomes

### 1. Stripe integration architecture

Use Stripe Checkout and signed webhooks. Add server-only configuration validation for:

- Secret key
- Publishable key
- Webhook signing secret
- Party Pass price/product identifier
- Application base URL
- Currency `gbp`
- Feature flag for checkout

Never trust client-supplied price, product, duration, user ID or success state.

### 2. Purchase and entitlement data model

Create canonical tables/records for:

- Checkout/purchase
- Stripe customer ID
- Checkout session/payment intent IDs
- Product/price snapshot
- Payment/refund/dispute status
- Entitlement type
- Purchased, activated, starts, expires and use-by timestamps
- Linked user and optionally linked event
- Webhook event ledger with unique Stripe event ID
- Audit trail

Do not store full card data.

### 3. Checkout flow

- Require an active verified organiser session.
- Create or reuse a Stripe customer mapped server-side.
- Create Checkout Session with fixed server-side Party Pass price.
- Put only non-sensitive internal references in Stripe metadata.
- Use strict success/cancel redirect allowlists.
- The success page must retrieve server-verified purchase status. A query string alone never grants access.
- Prevent duplicate active Checkout Sessions where practical.

### 4. Idempotent webhook processing

Handle at minimum the events actually required for Checkout/payment/refund/dispute lifecycle.

Requirements:

- Verify Stripe signature using raw request body.
- Insert Stripe event ID into a unique ledger before applying effects, using a transaction/idempotent design.
- Safely handle out-of-order and repeated events.
- Reconcile purchase state from Stripe object identifiers rather than trusting metadata alone.
- Never activate the 30-day window on checkout completion unless the product rule explicitly says activation at purchase. Default rule: purchased but unactivated.
- Refund/dispute updates entitlement according to reviewed policy and records an audit event.
- Return appropriate retry status for transient failures.

### 5. Entitlement enforcement

Create one server-side entitlement service used by event activation and relevant routes.

It must answer:

- Does the account have an eligible unactivated or active Party Pass?
- Is the pass inside its use-by and active period?
- Which event is linked?
- Can another event become live?
- What read-only access remains after expiry?

Rules:

- Activation is an explicit organiser action with confirmation.
- Activation sets `starts_at` and `expires_at = starts_at + 30 days` in one transaction.
- Link the pass to the chosen event.
- Expiry prevents starting/continuing paid live features according to clearly documented grace behaviour, but never deletes history.
- Server routes enforce entitlement. UI hiding is not security.
- Super-admin complimentary/beta grants use the same entitlement interface with a different source.

### 6. Account and purchase UI

Add:

- Pricing/checkout page
- Purchase status page
- Account entitlement card
- Activation flow selecting an event
- Countdown and exact expiry date/time
- Invoices/receipts link through Stripe-hosted customer tools where appropriate
- Clear prerequisites: compatible music account when using Spotify, internet, playback device and speakers
- Clear manual-mode option and limitations

Do not use fake scarcity or misleading savings claims.

### 7. Refund, cancellation and support handling

- Expose support-visible purchase/entitlement status without card data.
- Add audited super-admin actions only where Stripe APIs and policy permit.
- Do not implement arbitrary database toggles that disagree with Stripe.
- Link refunds to Stripe and let webhook reconciliation update local state.
- Record customer-visible status and next action.

### 8. Security and privacy

- Protect checkout creation and entitlement mutations with PRD-02 auth/CSRF.
- Rate-limit checkout creation.
- Redact Stripe objects and customer details in logs.
- Store only required billing identifiers and document retention/processors.
- Validate all webhook/object payloads.
- Add alerting for repeated webhook failures, signature failures and entitlement mismatches without exposing customer data.

### 9. Launch analytics

Record privacy-conscious funnel events:

- Pricing viewed
- Checkout started
- Purchase completed
- Pass activated
- Event ready
- Event started/ended
- Refund requested/completed

Use stable internal IDs and aggregate reporting. Do not send guest request content or Spotify tokens to analytics.

## Tests

Use Stripe test mode and fixtures:

- Server ignores client-supplied price/duration/user fields.
- Forged webhook rejected.
- Same webhook delivered repeatedly creates one purchase/effect.
- Out-of-order events reconcile correctly.
- Success URL without verified payment grants nothing.
- Purchase remains unactivated after payment.
- Activation starts exactly one 30-day window and cannot be repeated or moved without defined support flow.
- One pass cannot run two concurrent events.
- Expired/use-by rules enforced server-side.
- Refund/dispute updates entitlement correctly.
- Old/revoked admin session cannot create checkout or activate pass.
- Cross-tenant purchase lookup is impossible.
- Manual-mode buyer can fulfil the product without Spotify credentials.

## Acceptance criteria

- £19.99 GBP price is controlled by Stripe/server configuration, never the client.
- Webhooks are signature-verified, idempotent and transactionally applied.
- Party Pass is purchased first and explicitly activated later.
- Activation creates one 30-day event window.
- Entitlement enforcement is central and server-side.
- Purchase/refund/dispute states are auditable and reconciled with Stripe.
- Checkout remains disabled in production until platform/legal hard gates are marked complete.
- Full test-mode checkout, activation, event and expiry rehearsal passes.

## Non-goals

- Subscription billing
- Party Plus, venue or agency tiers
- Marketplace/tip-jar payments
- VAT/legal determination by the developer or LLM
