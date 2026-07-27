/**
 * CLI: apply canonical versioned SQL migrations (PRD-05).
 *
 * Usage:
 *   npx tsx scripts/db-migrate.ts
 *   npx tsx scripts/db-migrate.ts --dry-run
 *   npm run db:migrate:canonical
 *
 * Requires DATABASE_URL. Does not set ALLOW_DB_BOOTSTRAP.
 * Never runs Class C/D migrations.
 */

import { config } from 'dotenv';
import { closePool, getPool } from '../src/lib/db';
import {
  listCanonicalMigrations,
  runCanonicalMigrations,
} from '../src/lib/db/migrate/runner';

config({ path: '.env.local' });
config();

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const listOnly = process.argv.includes('--list');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  if (listOnly) {
    for (const migration of listCanonicalMigrations()) {
      console.log(
        `${migration.id} [${migration.classification}] ${migration.description}`
      );
    }
    return;
  }

  console.log(
    dryRun
      ? 'Dry-run: reporting pending canonical migrations…'
      : 'Applying canonical migrations…'
  );

  const pool = getPool();
  try {
    const result = await runCanonicalMigrations(pool, { dryRun });
    console.log(
      JSON.stringify(
        {
          dryRun: result.dryRun,
          applied: result.applied,
          skippedAlreadyApplied: result.skipped,
        },
        null,
        2
      )
    );
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
