/**
 * Removes accounts created by the test seed run.
 *
 * Safety: only deletes usernames on the SEED_USERS allowlist
 * (currently testuser1 / testuser2). Never wipes arbitrary users.
 *
 * Default: delete usernames recorded in the seed manifest as created
 * during the latest `test:seed-db` run.
 *
 * Flags:
 *   --all-seed   delete every SEED_USERS account (exact usernames)
 *   --username X delete a specific allowlisted seed username
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SEED_USERNAMES, SEED_USERS } from './seed-users-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'config/jest/test.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'test.env') });

export const SEED_MANIFEST_PATH = path.resolve(
  process.cwd(),
  'test-results',
  '.seeded-test-users.json'
);

export interface SeedUserManifest {
  createdAt: string;
  createdUsernames: string[];
  ensuredUsernames: string[];
}

interface CleanupOptions {
  /** Delete every allowlisted SEED_USERS username */
  allSeedUsers?: boolean;
  /** Extra allowlisted usernames to delete (e.g. leftover testuser2) */
  usernames?: string[];
  /** Skip cleanup when set (also honors TEST_KEEP_SEEDED_USERS=1) */
  keepSeededUsers?: boolean;
}

const ALLOWED_SEED_USERNAMES = new Set(SEED_USERNAMES);

function loadEnvDatabaseUrl(): string {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL not found. Set it in .env.local or config/jest/test.env'
    );
  }
  return DATABASE_URL;
}

export function readSeedManifest(): SeedUserManifest | null {
  if (!fs.existsSync(SEED_MANIFEST_PATH)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(SEED_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw) as SeedUserManifest;
    if (!parsed || !Array.isArray(parsed.createdUsernames)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSeedManifest(manifest: SeedUserManifest): void {
  const dir = path.dirname(SEED_MANIFEST_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SEED_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

export function clearSeedManifest(): void {
  if (fs.existsSync(SEED_MANIFEST_PATH)) {
    fs.unlinkSync(SEED_MANIFEST_PATH);
  }
}

function shouldKeepSeededUsers(options: CleanupOptions): boolean {
  if (options.keepSeededUsers) return true;
  const flag = process.env.TEST_KEEP_SEEDED_USERS;
  return flag === '1' || flag === 'true';
}

function resolveUsernamesToDelete(options: CleanupOptions): string[] {
  const requested = new Set<string>();
  const explicitUsernames = options.usernames || [];

  // Explicit --username targets only those accounts (still allowlisted).
  if (explicitUsernames.length > 0 && !options.allSeedUsers) {
    for (const username of explicitUsernames) {
      requested.add(username);
    }
    return [...requested].filter((username) => ALLOWED_SEED_USERNAMES.has(username));
  }

  if (options.allSeedUsers || process.env.TEST_CLEANUP_ALL_SEED_USERS === '1') {
    for (const user of SEED_USERS) {
      requested.add(user.username);
    }
  } else {
    const manifest = readSeedManifest();
    if (manifest) {
      for (const username of manifest.createdUsernames) {
        requested.add(username);
      }
    }
  }

  return [...requested].filter((username) => ALLOWED_SEED_USERNAMES.has(username));
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return result.rows.length > 0;
}

async function tableHasUserIdColumn(pool: Pool, tableName: string): Promise<boolean> {
  const cols = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'user_id'`,
    [tableName]
  );
  return cols.rows.length > 0;
}

async function deleteRelatedRows(pool: Pool, userId: string): Promise<void> {
  const relatedTables = [
    'requests',
    'spotify_auth',
    'user_settings',
    'user_events',
    'events',
    'password_reset_tokens',
  ];

  for (const table of relatedTables) {
    if (!(await tableExists(pool, table))) continue;
    if (!(await tableHasUserIdColumn(pool, table))) continue;
    await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  }
}

async function deleteAllowlistedUser(
  pool: Pool,
  username: string
): Promise<boolean> {
  if (!ALLOWED_SEED_USERNAMES.has(username)) {
    console.warn(`Skipping non-allowlisted username: ${username}`);
    return false;
  }

  const existing = await pool.query(
    `SELECT id, username, email FROM users WHERE username = $1`,
    [username]
  );
  if (existing.rows.length === 0) {
    console.log(`No seed user to delete: ${username}`);
    return false;
  }

  const row = existing.rows[0] as { id: string; username: string; email: string };
  // Extra guard: seed emails are *@example.com
  if (!String(row.email).toLowerCase().endsWith('@example.com')) {
    console.warn(
      `Refusing to delete ${username}: email is not an @example.com seed address`
    );
    return false;
  }

  await deleteRelatedRows(pool, row.id);
  await pool.query(`DELETE FROM users WHERE id = $1 AND username = $2`, [
    row.id,
    username,
  ]);
  console.log(`Deleted seed test user: ${username}`);
  return true;
}

/**
 * Delete seed accounts created by the latest seed run (manifest),
 * plus any explicitly requested allowlisted usernames.
 */
export async function cleanupSeededTestUsers(
  options: CleanupOptions = {}
): Promise<{ deleted: string[] }> {
  if (shouldKeepSeededUsers(options)) {
    console.log('Keeping seeded test users (TEST_KEEP_SEEDED_USERS).');
    return { deleted: [] };
  }

  const usernames = resolveUsernamesToDelete(options);
  if (usernames.length === 0) {
    console.log('No seeded test users marked for cleanup.');
    clearSeedManifest();
    return { deleted: [] };
  }

  const pool = new Pool({ connectionString: loadEnvDatabaseUrl() });
  const deleted: string[] = [];

  try {
    for (const username of usernames) {
      const removed = await deleteAllowlistedUser(pool, username);
      if (removed) deleted.push(username);
    }
  } finally {
    await pool.end();
  }

  // Only clear the suite manifest for default/all-seed cleanup.
  // Targeted --username deletes should not wipe the pending suite manifest.
  const targetedOnly =
    (options.usernames?.length || 0) > 0 && !options.allSeedUsers;
  if (!targetedOnly) {
    clearSeedManifest();
  } else {
    const manifest = readSeedManifest();
    if (manifest) {
      const remaining = manifest.createdUsernames.filter(
        (username) => !deleted.includes(username)
      );
      if (remaining.length === 0) {
        clearSeedManifest();
      } else {
        writeSeedManifest({
          ...manifest,
          createdUsernames: remaining,
        });
      }
    }
  }

  console.log(
    deleted.length > 0
      ? `Seed user cleanup complete (${deleted.join(', ')})`
      : 'Seed user cleanup complete (nothing deleted)'
  );
  return { deleted };
}

function parseCliArgs(argv: string[]): CleanupOptions {
  const options: CleanupOptions = { usernames: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all-seed') {
      options.allSeedUsers = true;
    } else if (arg === '--username' && argv[i + 1]) {
      options.usernames = [...(options.usernames || []), argv[i + 1]];
      i += 1;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseCliArgs(process.argv.slice(2));
  cleanupSeededTestUsers(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
