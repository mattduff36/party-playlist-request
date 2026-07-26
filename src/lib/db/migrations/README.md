# Database migrations

**Canonical (use these):** `canonical/` via `npm run db:migrate:canonical`

Legacy additive SQL copies remain in this directory for historical reference (`add_*.sql`). Prefer the numbered files under `canonical/`.

Conflicting Drizzle 7→4 tooling lives in `../_quarantine/drizzle-legacy/` — do not run against production.
