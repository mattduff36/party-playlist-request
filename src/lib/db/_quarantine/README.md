# Quarantined: conflicting Drizzle 4-table migration path and unused server state modules.
# Do not run 0001_migrate_7_to_4_tables.sql against production.
# Canonical schema + runner: src/lib/db/migrations/canonical + npm run db:migrate:canonical
#
# Also quarantined (PRD-05 foot-guns targeting spotify_tokens / Drizzle 4-table model):
# - indexes.ts / constraints.ts — npm scripts db:create-indexes / db:create-constraints exit 1
