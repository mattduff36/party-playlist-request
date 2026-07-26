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
