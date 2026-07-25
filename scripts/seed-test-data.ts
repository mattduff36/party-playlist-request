/**
 * Idempotent seed for critical-path API/e2e tests.
 * Users: testuser1 / testuser2 — password: testpassword123
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Prefer real app DB from .env.local; test.env only fills missing keys
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'config/jest/test.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'test.env') });

const PASSWORD = 'testpassword123';

interface SeedUser {
  username: string;
  email: string;
  displayName: string;
  pin: string;
  eventTitle: string;
}

const SEED_USERS: SeedUser[] = [
  {
    username: 'testuser1',
    email: 'testuser1@example.com',
    displayName: 'Test User 1',
    pin: '1111',
    eventTitle: 'DJ1 Test Event',
  },
  {
    username: 'testuser2',
    email: 'testuser2@example.com',
    displayName: 'Test User 2',
    pin: '2222',
    eventTitle: 'DJ2 Test Event',
  },
];

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return result.rows.length > 0;
}

async function upsertUser(
  pool: Pool,
  user: SeedUser,
  passwordHash: string
): Promise<string> {
  const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [
    user.username,
  ]);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users SET email = $2, password_hash = $3, display_name = $4 WHERE username = $1`,
      [user.username, user.email, passwordHash, user.displayName]
    );
    return existing.rows[0].id as string;
  }

  const inserted = await pool.query(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, 'user')
     RETURNING id`,
    [user.username, user.email, passwordHash, user.displayName]
  );
  return inserted.rows[0].id as string;
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

async function seedUserEvent(
  pool: Pool,
  userId: string,
  user: SeedUser
): Promise<void> {
  if (!(await tableExists(pool, 'user_events'))) return;
  const existing = await pool.query(
    `SELECT id FROM user_events WHERE user_id = $1 AND active = true LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE user_events SET pin = $2, name = $3 WHERE id = $1`,
      [existing.rows[0].id, user.pin, user.eventTitle]
    );
    return;
  }
  await pool.query(
    `INSERT INTO user_events (user_id, name, pin, bypass_token, active, expires_at)
     VALUES ($1, $2, $3, $4, true, NOW() + INTERVAL '7 days')`,
    [userId, user.eventTitle, user.pin, randomUUID()]
  );
}

async function seedEventsTable(
  pool: Pool,
  userId: string,
  user: SeedUser
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

  try {
    for (const user of SEED_USERS) {
      const userId = await upsertUser(pool, user, passwordHash);
      console.log(`User ready: ${user.username} (${userId})`);
      await seedSpotifyAuth(pool, userId);
      await seedUserEvent(pool, userId, user);
      await seedEventsTable(pool, userId, user);
      await seedPendingRequest(pool, userId);
    }
    console.log('Seed complete.');
    console.log('Credentials: testuser1|testuser2 / testpassword123');
    console.log('PINs: testuser1=1111, testuser2=2222');
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
