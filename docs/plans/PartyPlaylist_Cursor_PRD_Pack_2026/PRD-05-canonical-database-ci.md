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
