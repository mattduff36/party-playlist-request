## Next Steps (short, ordered)

1. Enable `MOCK_SPOTIFY_API=true` locally and in CI to avoid token refresh errors.
2. Seed test DB (`npm run test:setup-db && npm run test:seed-db`) before browser tests.
3. Run browser tests: `npm run test:browser` (uses Cursor flows); capture artifacts.
4. Add middleware guard assertions for multi-tenant isolation in tests.
5. Add more end-to-end specs for approve/reject requests and real-time updates.
6. Integrate link crawl and accessibility smoke into CI (export junit and coverage artifacts).
7. Redact secrets in server logs; add structured logging.
8. Migrate remaining `any` types in DB and Pusher layers.
9. Document operational runbooks (env, Pusher, Redis, Spotify toggles).
10. Schedule periodic dependency updates with lockfile maintenance.


