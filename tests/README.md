# Test Suite

Critical-path suite wired into `npm run finalise:full` / `finalise:full:push`.

## What finalise full runs

1. `npm run build`
2. `npm run test:unit` — Jest (libs + component smoke tests)
3. `npm run test:seed-db` — idempotent seed of `testuser1` / `testuser2`
4. Start production server with `SPOTIFY_MOCK=true`
5. `npm run test:api` — HTTP tests against localhost:3000
6. `npm run test:e2e` — Playwright Chromium (global teardown removes seed users created by this run)
7. `npm run test:cleanup-db` — remove any remaining seed users created by this run
8. Stop server, then commit (+ push if requested)

Seed cleanup only deletes allowlisted accounts (`testuser1` / `testuser2` with `@example.com` emails) that were newly created by seed. Pre-existing seed accounts are left alone. Set `TEST_KEEP_SEEDED_USERS=1` to skip cleanup. Use `npm run test:cleanup-db -- --all-seed` to remove both seed users, or `--username testuser2` for one account.

## Commands

```bash
npm run test:unit
npm run test:seed-db
# terminal A:
cross-env SPOTIFY_MOCK=true npm run start -- --port 3000
# terminal B:
set TEST_SERVER_URL=http://127.0.0.1:3000
npm run test:api
set PLAYWRIGHT_REUSE_SERVER=1
npm run test:e2e
```

## Credentials (seeded)

| User | Password | PIN |
|------|----------|-----|
| testuser1 | testpassword123 | 1111 |
| testuser2 | testpassword123 | 2222 |

## Spotify mock

Set `SPOTIFY_MOCK=true` on the server process. Implemented in `src/lib/spotify-mock.ts` — no live Spotify calls.

## Layout

| Path | Role |
|------|------|
| `tests/unit/` | Pure unit tests |
| `tests/api/` | HTTP integration (needs server) |
| `tests/e2e/` | Playwright |
| `tests/fixtures/` | Shared users / Spotify fixtures |
| `tests/utils/` | API client helpers |
| `tests/browser/` | **Optional manual helpers** — not run by finalise |
| `tests/mocks/` | MSW handlers (optional for future unit use) |

## Backlog (non-blocking)

See [docs/TEST-SUITE-SUMMARY.md](../docs/TEST-SUITE-SUMMARY.md) for routes/pages not yet covered (superadmin, monitoring, party-simulator, every playback sub-route, emails, load tests).
