/**
 * Idempotent seed for critical-path API/e2e tests.
 * Users: testuser1 / testuser2 — password: testpassword123
 *
 * Newly inserted seed users are recorded in a manifest so
 * scripts/cleanup-test-data.ts can remove them after the suite.
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  SEED_PASSWORD,
  SEED_USERS,
  type SeedUserConfig,
} from './seed-users-config';
import { writeSeedManifest } from './cleanup-test-data';

// Prefer real app DB from .env.local; test.env only fills missing keys
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'config/jest/test.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'test.env') });

const PASSWORD = SEED_PASSWORD;

interface UpsertResult {
  id: string;
  created: boolean;
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return result.rows.length > 0;
}

/** Ensure schema can store 6/8-char access codes before seeding. */
async function ensureAccessCodeSchema(pool: Pool): Promise<void> {
  if (!(await tableExists(pool, 'user_events'))) return;

  await pool.query(`
    ALTER TABLE user_events
    ALTER COLUMN pin TYPE TEXT
  `).catch(() => undefined);

  // Drop legacy 4-digit-only check before writing 6-digit seed codes
  await pool.query(`
    ALTER TABLE user_events
    DROP CONSTRAINT IF EXISTS user_events_pin_check
  `).catch(() => undefined);

  await pool.query(`
    ALTER TABLE user_events
    ADD COLUMN IF NOT EXISTS access_code TEXT
  `).catch(() => undefined);

  await pool.query(`
    ALTER TABLE user_events
    DROP CONSTRAINT IF EXISTS user_events_access_code_format_check
  `).catch(() => undefined);

  await pool.query(`
    ALTER TABLE user_events
    ADD CONSTRAINT user_events_access_code_format_check
    CHECK (
      pin ~ '^[0-9]{4}$'
      OR pin ~ '^[0-9]{6}$'
      OR pin ~ '^[0-9A-HJ-NP-Z]{8}$'
    )
  `).catch(() => undefined);

  if (await tableExists(pool, 'user_settings')) {
    await pool.query(`
      ALTER TABLE user_settings
      ADD COLUMN IF NOT EXISTS secure_url_access BOOLEAN DEFAULT FALSE
    `).catch(() => undefined);
  }
}

/** Clear stale single-session locks so e2e login is not stuck on transfer modal. */
async function clearActiveSessions(pool: Pool, userId: string): Promise<void> {
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'active_session_id'`
  );
  if (cols.rows.length === 0) return;
  await pool.query(
    `UPDATE users
     SET active_session_id = NULL, active_session_created_at = NULL
     WHERE id = $1`,
    [userId]
  );
}

async function upsertUser(
  pool: Pool,
  user: SeedUserConfig,
  passwordHash: string
): Promise<UpsertResult> {
  const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [
    user.username,
  ]);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users SET email = $2, password_hash = $3, display_name = $4 WHERE username = $1`,
      [user.username, user.email, passwordHash, user.displayName]
    );
    return { id: existing.rows[0].id as string, created: false };
  }

  const inserted = await pool.query(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, 'user')
     RETURNING id`,
    [user.username, user.email, passwordHash, user.displayName]
  );
  return { id: inserted.rows[0].id as string, created: true };
}

async function seedSpotifyAuth(pool: Pool, userId: string): Promise<void> {
  if (!(await tableExists(pool, 'spotify_auth'))) return;
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'spotify_auth' AND column_name = 'user_id'`
  );
  if (cols.rows.length === 0) return;

  const expiresAt = new Date(Date.now() + 3600 * 1000);
  const existing = await pool.query(
    `SELECT user_id FROM spotify_auth WHERE user_id = $1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE spotify_auth
       SET access_token = $2, refresh_token = $3, expires_at = $4, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, `mock_access_${userId.slice(0, 8)}`, `mock_refresh_${userId.slice(0, 8)}`, expiresAt]
    );
    return;
  }
  await pool.query(
    `INSERT INTO spotify_auth (user_id, access_token, refresh_token, expires_at, scope, token_type, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'Bearer', NOW())`,
    [
      userId,
      `mock_access_${userId.slice(0, 8)}`,
      `mock_refresh_${userId.slice(0, 8)}`,
      expiresAt,
      'user-modify-playback-state user-read-playback-state',
    ]
  );
}


async function seedUserSettings(
  pool: Pool,
  userId: string,
  user: SeedUserConfig
): Promise<void> {
  if (!(await tableExists(pool, 'user_settings'))) return;
  const existing = await pool.query(
    `SELECT user_id FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE user_settings
       SET event_title = $2,
           welcome_message = $3,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, user.eventTitle, `Welcome to ${user.eventTitle}`]
    );
    return;
  }
  await pool.query(
    `INSERT INTO user_settings (user_id, event_title, welcome_message)
     VALUES ($1, $2, $3)`,
    [userId, user.eventTitle, `Welcome to ${user.eventTitle}`]
  );
}

async function seedUserEvent(
  pool: Pool,
  userId: string,
  user: SeedUserConfig
): Promise<void> {
  if (!(await tableExists(pool, 'user_events'))) return;

  // Keep a single active event with the canonical seed access code
  await pool.query(
    `UPDATE user_events
     SET active = false, ended_at = COALESCE(ended_at, NOW())
     WHERE user_id = $1 AND active = true`,
    [userId]
  );

  const existing = await pool.query(
    `SELECT id FROM user_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  const accessCode = user.pin;
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE user_events
       SET pin = $2,
           access_code = $2,
           name = $3,
           active = true,
           ended_at = NULL,
           expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $1`,
      [existing.rows[0].id, accessCode, user.eventTitle]
    );
    return;
  }

  await pool.query(
    `INSERT INTO user_events (user_id, name, pin, access_code, bypass_token, active, expires_at)
     VALUES ($1, $2, $3, $3, $4, true, NOW() + INTERVAL '7 days')`,
    [userId, user.eventTitle, accessCode, `bp_${randomUUID().replace(/-/g, '')}`]
  );
}

async function seedEventsTable(
  pool: Pool,
  userId: string,
  user: SeedUserConfig
): Promise<void> {
  if (!(await tableExists(pool, 'events'))) return;
  const existing = await pool.query(`SELECT id FROM events WHERE user_id = $1 LIMIT 1`, [
    userId,
  ]);
  const config = {
    pages_enabled: { requests: true, display: true },
    event_title: user.eventTitle,
    welcome_message: `Welcome to ${user.eventTitle}`,
    secondary_message: '',
    tertiary_message: '',
    show_qr_code: true,
  };
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE events SET pin = $2, status = 'live', config = $3::jsonb WHERE id = $1`,
      [existing.rows[0].id, user.pin, JSON.stringify(config)]
    );
    return;
  }
  await pool.query(
    `INSERT INTO events (user_id, pin, status, config)
     VALUES ($1, $2, 'live', $3::jsonb)`,
    [userId, user.pin, JSON.stringify(config)]
  );
}

async function seedPendingRequest(pool: Pool, userId: string): Promise<void> {
  if (!(await tableExists(pool, 'requests'))) return;
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'requests' AND column_name = 'user_id'`
  );
  if (cols.rows.length === 0) return;

  const existing = await pool.query(
    `SELECT id FROM requests WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) return;

  await pool.query(
    `INSERT INTO requests (
      id, user_id, track_uri, track_name, artist_name, album_name,
      duration_ms, requester_ip_hash, requester_nickname, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
    [
      randomUUID(),
      userId,
      'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
      'Blinding Lights',
      'The Weeknd',
      'After Hours',
      200000,
      'testhash',
      'SeedGuest',
    ]
  );
}

async function seedTestData() {
  console.log('Seeding test database (idempotent)...');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL not found. Set it in .env.local or config/jest/test.env'
    );
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const createdUsernames: string[] = [];
  const ensuredUsernames: string[] = [];

  try {
    await ensureAccessCodeSchema(pool);

    for (const user of SEED_USERS) {
      const { id: userId, created } = await upsertUser(pool, user, passwordHash);
      ensuredUsernames.push(user.username);
      if (created) {
        createdUsernames.push(user.username);
        console.log(`User created: ${user.username} (${userId})`);
      } else {
        console.log(`User ready (existing): ${user.username} (${userId})`);
      }
      await clearActiveSessions(pool, userId);
      await seedSpotifyAuth(pool, userId);
      await seedUserEvent(pool, userId, user);
      await seedUserSettings(pool, userId, user);
      await seedEventsTable(pool, userId, user);
      await seedPendingRequest(pool, userId);
    }

    // Canonical SEED_USERS are durable fixtures — do not mark them for cleanup.
    // Only dynamic/orphan usernames from a prior manifest (if still allowlisted
    // and not part of SEED_USERS) would be cleaned; currently that set is empty.
    writeSeedManifest({
      createdAt: new Date().toISOString(),
      createdUsernames: [],
      ensuredUsernames,
    });

    console.log('Seed complete.');
    console.log('Credentials: testuser1|testuser2 / testpassword123');
    console.log('Access codes: testuser1=101234, testuser2=202345');
    console.log(
      createdUsernames.length > 0
        ? `Ensured seed fixtures (kept after suite): ${createdUsernames.join(', ')}`
        : 'Seed fixtures already present (kept after suite).'
    );
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedTestData, SEED_USERS, PASSWORD };
