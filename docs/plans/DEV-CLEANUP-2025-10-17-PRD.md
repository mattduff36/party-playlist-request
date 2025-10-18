# Dev Cleanup PRD — 2025-10-17

## Objective
Achieve a clean, type-safe, and lint-clean codebase with reliable builds, aligning with Next.js 15 contracts and our app conventions.

## Scope
- Fix TypeScript errors and route signatures
- Align event and pusher contracts
- Stabilize display/request pages after recent fixes
- Normalize DB/Redis/Spotify typings and APIs
- Resolve ESLint violations, viewport warnings, and image usage
- Harden CI for type-check and lint blocking

## Success Criteria
- `npx tsc --noEmit` passes
- `npx eslint . --ext .ts,.tsx --max-warnings=0` passes
- `npm run build` produces no Next warnings about viewport metadata (except third-party)
- App boots locally and core flows function (display, request, admin basics)

---

## P0 — Blockers to type-check/build correctness
1) Route handler signatures (Next.js 15)
   - Update all App Router API handlers to use `context: { params: Promise<...> }` and `await context.params`
2) Auth/DB exports
   - Re-export or correct imports for `verifyJWT`, `db`, `dbService`
3) Display/Request pages
   - Remove undefined identifiers (`setAuthenticated`, `setError`), duplicate object keys, invalid `display_refresh_interval` property
4) Events Poll endpoint
   - Fix column names (`event_id`, `created_at`), event action casing, `db` import

Deliverable: Type-check passes for edited areas; build green.

## P1 — Event/Pusher contract alignment
1) Normalize `EventAction` string unions and all emitters/handlers
2) Resolve duplicate/conflicting exports in `src/lib/pusher/*` and wrong arg counts
3) Transport typing in client (`Transport[]`) and deduplication generics

Deliverable: `tsc` clean in `src/lib/pusher/**`, no union mismatches.

## P2 — Data layer typing normalization
1) Drizzle and DB service types aligned (remove ad-hoc strings, use unions)
2) Redis client/rate-limiter nullability and initializers
3) Logging/monitoring metric schemas tightened

Deliverable: `tsc` clean across `src/lib/db/**`, `src/lib/redis/**`, `src/lib/monitoring/**`.

## P3 — Lint & UX consistency
1) Convert `scripts/**` to ESM or relax ESLint via scoped override
2) Replace `<img>` with `next/image` where applicable
3) Add missing hook deps or refactor
4) Migrate metadata viewport to `export const viewport`

Deliverable: ESLint passes with `--max-warnings=0`; Next viewport warnings gone.

## P4 — CI hardening
1) Add CI job with steps:
   - `npm ci`
   - `npx tsc --noEmit`
   - `npx eslint . --ext .ts,.tsx --max-warnings=0`
   - `npm run build`
2) Optional: type-check during build or enforce via CI only.

Deliverable: CI fails on type or lint errors.

---

## Test Plan (per block)
- After each block, run:
  - `npx tsc --noEmit`
  - `npx eslint . --ext .ts,.tsx --max-warnings=0` (or targeted paths during early blocks)
  - `npm run build`
- Manual: smoke test display and request flows locally.

## Rollback
- Work in branch `chore/dev-cleanup-2025-10-17`
- Commit per task; can revert individual commits quickly.


