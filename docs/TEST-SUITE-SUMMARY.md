# Test Suite Summary (July 2026)

## Finalise full pipeline

`npm run finalise:full` / `finalise:full:push` runs:

1. Clean production `build`
2. **`test:unit`** — Jest projects: `tests/unit/**` + `src/**/__tests__/**`
3. **`test:seed-db`** — upsert `testuser1` / `testuser2` (`testpassword123`)
4. Production server on `:3000` with **`SPOTIFY_MOCK=true`**
5. **`test:api`** — HTTP critical-path suites
6. **`test:e2e`** — Playwright Chromium (`PLAYWRIGHT_REUSE_SERVER=1`)
7. Commit (+ push when using `:push`)

Spotify is **mocked only** in this path. No live OAuth/playback.

## On-disk coverage (critical path)

| Layer | Location | Focus |
|-------|----------|--------|
| Unit | `tests/unit/` | auth lib, bcrypt/jwt, rate-limit, search-cache, profanity, Spotify mock |
| Components | `src/**/__tests__/` | Page/State/Spotify panels smoke + ErrorBoundary |
| API | `tests/api/` | auth, multi-tenant, guest request/search, admin lifecycle, event/public |
| E2E | `tests/e2e/` | auth, admin event, guest request, display, isolation smoke |

Approximate count after this initiative: **~90–120** automated cases (not the historical false “220+”).

## Credentials

- `testuser1` / `testpassword123` (PIN `1111`)
- `testuser2` / `testpassword123` (PIN `2222`)

Env: `DATABASE_URL` + `JWT_SECRET` from `.env.local` (seed/API/e2e). Jest also loads `config/jest/test.env` when present.

## Spotify mock

- Flag: `SPOTIFY_MOCK=true`
- Code: `src/lib/spotify-mock.ts` + guards in `src/lib/spotify.ts`
- Search route short-circuits under mock without DB tokens

## Optional / not in finalise

| Asset | Notes |
|-------|--------|
| `tests/browser/*` | Manual/legacy fetch helpers |
| `npm run test:browser` | Optional |
| Load/performance scripts | Removed from package.json (were broken) |

## Backlog (does not block finalise)

| Domain | Examples |
|--------|----------|
| Superadmin | `/api/superadmin/*`, party-simulator |
| Monitoring | health/metrics/dashboard/errors |
| Playback sub-routes | every pause/resume/skip/volume edge case |
| Email / notifications | SendGrid, notification CRUD |
| Pusher channel auth | dedicated isolation suite |
| OAuth callback | Spotify authorize/callback (live or deeper mock) |
| Legal pages | privacy/terms/contact smoke |
| Register / forgot-password | invitation-only product path |

Add these incrementally; keep `finalise:full` green and under ~20 minutes locally.
