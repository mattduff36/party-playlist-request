/**
 * Database Test Utilities
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: './test.env' });

let pool: Pool | null = null;

export function getTestDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function cleanDatabase() {
  const pool = getTestDbPool();
  
  await pool.query('TRUNCATE TABLE requests CASCADE');
  await pool.query('TRUNCATE TABLE spotify_tokens CASCADE');
  await pool.query('TRUNCATE TABLE events CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');
}

export async function closeTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function createTestUser(userData: {
  username: string;
  email: string;
  password_hash: string;
  display_name?: string;
  role?: string;
}) {
  const pool = getTestDbPool();
  
  const result = await pool.query(`
    INSERT INTO users (username, email, password_hash, display_name, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    userData.username,
    userData.email,
    userData.password_hash,
    userData.display_name || userData.username,
    userData.role || 'user',
  ]);
  
  return result.rows[0];
}

export async function createTestEvent(eventData: {
  user_id: string;
  pin: string;
  status: string;
  config: any;
}) {
  const pool = getTestDbPool();
  
  const result = await pool.query(`
    INSERT INTO events (user_id, pin, status, config)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [
    eventData.user_id,
    eventData.pin,
    eventData.status,
    JSON.stringify(eventData.config),
  ]);
  
  return result.rows[0];
}

export async function createTestRequest(requestData: {
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name?: string;
  album_image_url?: string;
  requester_nickname?: string;
  status?: string;
}) {
  const pool = getTestDbPool();
  
  const result = await pool.query(`
    INSERT INTO requests (
      track_uri, track_name, artist_name, album_name, 
      album_image_url, requester_nickname, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    requestData.track_uri,
    requestData.track_name,
    requestData.artist_name,
    requestData.album_name || null,
    requestData.album_image_url || null,
    requestData.requester_nickname || 'Anonymous',
    requestData.status || 'pending',
  ]);
  
  return result.rows[0];
}


