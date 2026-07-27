import { TICK_LEASE_MS } from './constants';

export interface PlaybackFingerprintParts {
  trackUri: string | null;
  isPlaying: boolean;
  deviceId: string | null;
}

export function buildPlaybackFingerprint(parts: PlaybackFingerprintParts): string {
  return `${parts.trackUri ?? ''}|${parts.isPlaying ? '1' : '0'}|${parts.deviceId ?? ''}`;
}

export interface SyncRow {
  fingerprint: string | null;
  progress_ms: number | null;
  is_playing: boolean | null;
  snapshot_json: unknown;
}

/**
 * Try to acquire a short-lived per-user tick lease.
 * Returns true if this caller won and should poll Spotify.
 * `force` bypasses the lease (approve / manual refresh-queue).
 */
export async function tryAcquireTickLease(
  userId: string,
  options: { force?: boolean; leaseMs?: number } = {}
): Promise<boolean> {
  const { force = false, leaseMs = TICK_LEASE_MS } = options;
  const { sql } = await import('@/lib/db/neon-client');
  const leaseUntil = new Date(Date.now() + leaseMs).toISOString();

  if (force) {
    await sql`
      INSERT INTO spotify_playback_sync (user_id, lease_until, updated_at)
      VALUES (${userId}, ${leaseUntil}::timestamptz, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET lease_until = ${leaseUntil}::timestamptz,
          updated_at = NOW()
    `;
    return true;
  }

  const rows = await sql`
    INSERT INTO spotify_playback_sync (user_id, lease_until, updated_at)
    VALUES (${userId}, ${leaseUntil}::timestamptz, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET lease_until = ${leaseUntil}::timestamptz,
        updated_at = NOW()
    WHERE spotify_playback_sync.lease_until IS NULL
       OR spotify_playback_sync.lease_until < NOW()
    RETURNING user_id
  `;

  return rows.length > 0;
}

export async function getSyncRow(userId: string): Promise<SyncRow | null> {
  const { sql } = await import('@/lib/db/neon-client');
  const rows = await sql`
    SELECT fingerprint, progress_ms, is_playing, snapshot_json
    FROM spotify_playback_sync
    WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  return rows[0] as SyncRow;
}

export async function persistSyncState(
  userId: string,
  state: {
    fingerprint: string;
    progressMs: number;
    isPlaying: boolean;
    snapshot?: unknown;
  }
): Promise<void> {
  const { sql } = await import('@/lib/db/neon-client');
  const snapshot = state.snapshot ?? null;
  await sql`
    INSERT INTO spotify_playback_sync (
      user_id,
      fingerprint,
      progress_ms,
      is_playing,
      snapshot_json,
      updated_at
    )
    VALUES (
      ${userId},
      ${state.fingerprint},
      ${state.progressMs},
      ${state.isPlaying},
      ${snapshot},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET fingerprint = EXCLUDED.fingerprint,
        progress_ms = EXCLUDED.progress_ms,
        is_playing = EXCLUDED.is_playing,
        snapshot_json = COALESCE(EXCLUDED.snapshot_json, spotify_playback_sync.snapshot_json),
        updated_at = NOW()
  `;
}

/**
 * Verify playback-sync table exists (PRD-05: no request-time DDL).
 * Table is created by canonical migration `004_spotify_playback_sync`.
 */
export async function ensurePlaybackSyncTable(): Promise<void> {
  const { getPool } = await import('@/lib/db');
  const result = await getPool().query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'spotify_playback_sync'
     ) AS exists`
  );
  if (!result.rows[0]?.exists) {
    throw new Error(
      'spotify_playback_sync missing — run npm run db:migrate:canonical (no request-time DDL)'
    );
  }
}
