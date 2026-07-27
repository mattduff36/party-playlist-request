/**
 * Idempotent guest request insert + duplicate-track policy (PRD-06 / PRD-07).
 */

import { randomUUID } from 'crypto';
import { getPool, type Request } from '@/lib/db';

const IDEMPOTENCY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(
  value: unknown
): value is string {
  return typeof value === 'string' && IDEMPOTENCY_RE.test(value);
}

export interface CreateIdempotentRequestInput {
  userId: string;
  eventId: string | null;
  idempotencyKey: string;
  track_uri?: string | null;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_image_url?: string | null;
  duration_ms?: number;
  requester_ip_hash: string;
  requester_nickname?: string;
  user_session_id?: string;
  status: string;
  approved_at?: string;
  approved_by?: string;
  /** Minutes before the same track may be requested again while pending/approved */
  duplicateCooldownMinutes?: number;
  provider_id?: string | null;
  provider_track_id?: string | null;
  dedication?: string | null;
  normalized_track_key?: string | null;
}

export type IdempotentCreateResult =
  | { kind: 'created'; request: Request }
  | { kind: 'replay'; request: Request }
  | { kind: 'duplicate_track'; request: Request };

/**
 * Insert request with unique (event_id, idempotency_key).
 * Duplicate track check runs in the same transaction when event_id is present.
 * Spotify: match track_uri. Manual: match normalized_track_key.
 */
export async function createIdempotentRequest(
  input: CreateIdempotentRequestInput
): Promise<IdempotentCreateResult> {
  const pool = getPool();
  const client = await pool.connect();
  const cooldown = input.duplicateCooldownMinutes ?? 30;
  const id = randomUUID();
  const nicknameRetainUntil = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    await client.query('BEGIN');

    if (input.eventId && input.idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM requests
         WHERE event_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [input.eventId, input.idempotencyKey]
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return { kind: 'replay', request: existing.rows[0] as Request };
      }
    }

    let dup;
    if (input.normalized_track_key) {
      dup = await client.query(
        `SELECT * FROM requests
         WHERE user_id = $1
           AND normalized_track_key = $2
           AND status IN ('pending', 'approved', 'approving')
           AND created_at > NOW() - ($3::text || ' minutes')::interval
           AND (archived_at IS NULL)
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [input.userId, input.normalized_track_key, String(cooldown)]
      );
    } else if (input.track_uri) {
      dup = await client.query(
        `SELECT * FROM requests
         WHERE user_id = $1
           AND track_uri = $2
           AND status IN ('pending', 'approved', 'approving')
           AND created_at > NOW() - ($3::text || ' minutes')::interval
           AND (archived_at IS NULL)
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [input.userId, input.track_uri, String(cooldown)]
      );
    }

    if (dup?.rows[0]) {
      await client.query('COMMIT');
      return { kind: 'duplicate_track', request: dup.rows[0] as Request };
    }

    const inserted = await client.query(
      `INSERT INTO requests (
         id, track_uri, track_name, artist_name, album_name, album_image_url, duration_ms,
         requester_ip_hash, requester_nickname, user_session_id, status,
         spotify_added_to_queue, spotify_added_to_playlist, user_id,
         event_id, idempotency_key, nickname_retain_until, approved_at, approved_by,
         provider_id, provider_track_id, dedication, normalized_track_key
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         false, false, $12,
         $13, $14, $15, $16, $17,
         $18, $19, $20, $21
       )
       RETURNING *`,
      [
        id,
        input.track_uri ?? null,
        input.track_name,
        input.artist_name,
        input.album_name,
        input.album_image_url ?? null,
        input.duration_ms ?? 0,
        input.requester_ip_hash,
        input.requester_nickname ?? null,
        input.user_session_id ?? null,
        input.status,
        input.userId,
        input.eventId,
        input.idempotencyKey,
        nicknameRetainUntil,
        input.approved_at ?? null,
        input.approved_by ?? null,
        input.provider_id ?? null,
        input.provider_track_id ?? null,
        input.dedication ?? null,
        input.normalized_track_key ?? null,
      ]
    );

    await client.query('COMMIT');
    return { kind: 'created', request: inserted.rows[0] as Request };
  } catch (error) {
    await client.query('ROLLBACK');
    // Unique violation on idempotency → replay
    const code = (error as { code?: string }).code;
    if (code === '23505' && input.eventId) {
      const existing = await pool.query(
        `SELECT * FROM requests
         WHERE event_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [input.eventId, input.idempotencyKey]
      );
      if (existing.rows[0]) {
        return { kind: 'replay', request: existing.rows[0] as Request };
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
