# Canonical migration runner

## Commands

```bash
npm run db:migrate:canonical:list   # list ordered migrations
npm run db:migrate:canonical:dry    # report pending (no writes)
npm run db:migrate:canonical        # apply pending Class A/B SQL
```

Requires `DATABASE_URL`. Uses `schema_migrations` for history.

## Production checklist

1. Confirm backup `snap-odd-dream-abwtma9w` (or newer) exists.
2. Dry-run against a branch/clone first when possible.
3. Apply only Class B additive SQL from `src/lib/db/migrations/canonical/`.
4. Stop for human approval on any Class C/D (backfill, drop, purge).

## Fresh database

```bash
createdb partyplaylist_dev   # or Neon empty branch
export DATABASE_URL=...
npm run db:migrate:canonical
```

A blank Postgres should reach the live multi-tenant shape from migrations alone — **not** via request-time DDL and **not** via `ALLOW_DB_BOOTSTRAP` in production.

## Rollback

Each SQL file documents Class B reverse notes (drop new columns/indexes only after readers are gone). Prefer forward-fix migrations over destructive downgrades.

## Deprecated paths

| Path | Status |
| --- | --- |
| `npm run db:migrate` / `db:push` / `db:generate` / `db:studio` | Disabled — exit 1 |
| `npm run db:create-indexes` / `db:create-constraints` / analyze / validate-data | Disabled — exit 1 (spotify_tokens foot-guns; sources under `_quarantine/`) |
| `src/lib/db/_quarantine/*` | Archive only |
| `initializeDatabase()` | CLI + `ALLOW_DB_BOOTSTRAP=1` fallback only |

Dry-run (`db:migrate:canonical:dry`) is **write-free**: it only reads `information_schema` / `schema_migrations` and never calls `CREATE TABLE`.
