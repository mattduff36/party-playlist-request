# Production Readiness Audit (2025-10-18)

## Summary
- App: Next.js 15, React 19, TypeScript 5.9
- Realtime: Pusher (client/server), event contract unified with `state_change`
- DB: Postgres (Neon-compatible), Drizzle + legacy `pg` pool
- Redis: Optional; rate-limiter present
- Tests: Jest unit/integration; Cursor-based browser flows scaffolded

## Priorities
- P0
  - Validate auth/session integrity across multi-tenant routes (`src/app/api/**`) and ensure all admin routes check username/user_id.
  - Spotify invalid_client refresh loops: gate real Spotify via feature flag; ensure MOCK_SPOTIFY_API for dev/tests.
  - Ensure Pusher channel isolation by user (already implemented; verify env keys present).
- P1
  - Harden error paths with consistent JSON errors and logging redactors.
  - Add CSP/security headers and disable `x-powered-by` (done via `poweredByHeader: false`).
  - Gate monitoring UI by `NEXT_PUBLIC_ENABLE_MONITORING` (done).
- P2
  - Remove legacy any-types progressively (db service, pusher broadcaster).
  - Add end-to-end link crawl and accessibility smoke to CI.

## Findings (selected)
- Spotify watcher logs 400 invalid_client when refresh runs. Use mocked creds in dev/test; provide explicit docs.
- Multiple API routes rely on `DATABASE_URL` directly; acceptable but central pool manager exists. Standardize usage for observability.
- Session transfer flow present; ensure force logout Pusher event delivered and handled.
- Next image policies improved; some components still using `img` with lint disables (acceptable for now).

## Recommendations
- Enforce `MOCK_SPOTIFY_API=true` in non-production.
- Add middleware guards for per-tenant access on `/[username]/admin/**`.
- Expand tests to cover approve/reject request and state transitions.


