/**
 * Versioned SQL migration runner (PRD-05).
 *
 * Uses the singleton pg pool from `@/lib/db`. Applies ordered migrations
 * transactionally where PostgreSQL permits. Never performs Class C/D work.
 */

import fs from 'fs';
import path from 'path';
import type { Pool, PoolClient } from 'pg';
import { CANONICAL_MIGRATIONS, type MigrationDefinition } from './registry';

const MIGRATIONS_DIR = path.join(
  process.cwd(),
  'src',
  'lib',
  'db',
  'migrations',
  'canonical'
);

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  dryRun: boolean;
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedIds(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM schema_migrations`
  );
  return new Set(result.rows.map((row) => row.id));
}

function readMigrationSql(definition: MigrationDefinition): string {
  const fullPath = path.join(MIGRATIONS_DIR, definition.file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Migration file missing: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Apply pending canonical migrations.
 * @param pool pg Pool (normally getPool())
 * @param options.dryRun when true, report pending without executing
 */
export async function runCanonicalMigrations(
  pool: Pool,
  options: { dryRun?: boolean } = {}
): Promise<MigrationResult> {
  const dryRun = options.dryRun === true;
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await ensureMigrationsTable(client);
    const done = await appliedIds(client);

    for (const migration of CANONICAL_MIGRATIONS) {
      if (migration.classification !== 'A' && migration.classification !== 'B') {
        throw new Error(
          `Refusing migration ${migration.id}: classification ${migration.classification} is not auto-applicable`
        );
      }

      if (done.has(migration.id)) {
        skipped.push(migration.id);
        continue;
      }

      const sql = readMigrationSql(migration);

      if (dryRun) {
        applied.push(migration.id);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (id, applied_at) VALUES ($1, NOW())`,
          [migration.id]
        );
        await client.query('COMMIT');
        applied.push(migration.id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${migration.id} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return { applied, skipped, dryRun };
  } finally {
    client.release();
  }
}

export function listCanonicalMigrations(): MigrationDefinition[] {
  return [...CANONICAL_MIGRATIONS];
}
