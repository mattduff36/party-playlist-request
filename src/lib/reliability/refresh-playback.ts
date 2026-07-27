/**
 * Server-only playback refresh with shared debounce + staleness (PRD-06).
 * Uses Neon lease (durable) plus optional Redis debounce across instances.
 * Never claims real-time/current when the snapshot is stale.
 */

import { getRedisClient } from '@/lib/redis/client';
import { PLAYBACK_STALE_MS } from '@/lib/spotify-sync/constants';
import { getSyncRow } from '@/lib/spotify-sync/lease';
import { tickUserPlayback, type TickResult } from '@/lib/spotify-sync/tick';
import {
  isStaleFetchedAt,
  type PlaybackServiceSnapshot,
  type ServiceState,
} from './service-states';

const REDIS_DEBOUNCE_PREFIX = 'playback_refresh:v1:';

export interface RefreshPlaybackResult {
  tick: TickResult;
  snapshot: PlaybackServiceSnapshot;
  redisBackend: 'redis' | 'none';
  debounced: boolean;
}

async function tryRedisDebounce(
  userId: string,
  minIntervalMs: number
): Promise<{ acquired: boolean; backend: 'redis' | 'none' }> {
  const redis = getRedisClient();
  if (!redis.isReady()) {
    try {
      await redis.initialize();
    } catch {
      return { acquired: true, backend: 'none' };
    }
  }
  if (!redis.isReady()) {
    return { acquired: true, backend: 'none' };
  }

  const key = `${REDIS_DEBOUNCE_PREFIX}${userId}`;
  const ttlSec = Math.max(1, Math.ceil(minIntervalMs / 1000));
  // SET NX via incrEx on a short-lived key: first caller gets count=1
  const count = await redis.incrEx(key, ttlSec);
  if (count === null) {
    return { acquired: true, backend: 'none' };
  }
  if (count > 1) {
    return { acquired: false, backend: 'redis' };
  }
  return { acquired: true, backend: 'redis' };
}

async function loadSnapshot(
  userId: string,
  fallbackStatus: ServiceState
): Promise<PlaybackServiceSnapshot> {
  try {
    const row = await getSyncRow(userId);
    const fetchedAt =
      (row as { fetched_at?: string } | null)?.fetched_at ||
      new Date().toISOString();
    const providerStatus =
      ((row as { provider_status?: ServiceState } | null)?.provider_status as
        | ServiceState
        | undefined) || fallbackStatus;
    const degraded =
      Boolean((row as { degraded?: boolean } | null)?.degraded) ||
      isStaleFetchedAt(fetchedAt, PLAYBACK_STALE_MS);
    const stale = isStaleFetchedAt(fetchedAt, PLAYBACK_STALE_MS);

    return {
      fetchedAt,
      providerStatus: stale && providerStatus === 'healthy' ? 'stale' : providerStatus,
      stale,
      degraded: degraded || stale,
      fingerprint: row?.fingerprint ?? null,
      isPlaying: row?.is_playing ?? undefined,
      progressMs: row?.progress_ms ?? null,
    };
  } catch {
    return {
      fetchedAt: new Date(0).toISOString(),
      providerStatus: 'provider_unavailable',
      stale: true,
      degraded: true,
    };
  }
}

/**
 * Refresh playback for an organiser. Debounced across instances.
 */
export async function refreshPlaybackState(
  userId: string,
  username: string,
  reason: string,
  options: { force?: boolean; minIntervalMs?: number } = {}
): Promise<RefreshPlaybackResult> {
  const force = options.force === true;
  const minIntervalMs = options.minIntervalMs ?? PLAYBACK_STALE_MS;

  if (!force) {
    const debounce = await tryRedisDebounce(userId, minIntervalMs);
    if (!debounce.acquired) {
      const snapshot = await loadSnapshot(userId, 'healthy');
      return {
        tick: {
          userId,
          username,
          skipped: true,
          reason: 'lease',
          broadcast: false,
          isPlaying: Boolean(snapshot.isPlaying),
        },
        snapshot,
        redisBackend: debounce.backend,
        debounced: true,
      };
    }
  }

  const tick = await tickUserPlayback(userId, username, {
    force,
    queueInterval: force ? 0 : undefined,
  });

  let providerStatus: ServiceState = 'healthy';
  if (tick.reason === 'disconnected') {
    providerStatus = 'provider_disconnected';
  } else if (tick.reason === 'error') {
    providerStatus = 'provider_unavailable';
  }

  // Persist freshness metadata when columns exist (Class B migration)
  try {
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    await pool.query(
      `UPDATE spotify_playback_sync
       SET fetched_at = NOW(),
           provider_status = $2,
           degraded = $3,
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        providerStatus,
        providerStatus !== 'healthy',
      ]
    );
  } catch {
    // Column may not exist until migration applied — non-fatal
  }

  const snapshot = await loadSnapshot(userId, providerStatus);
  if (reason) {
    console.log(
      `[refreshPlaybackState] user=${userId} reason=${reason} skipped=${tick.skipped} stale=${snapshot.stale}`
    );
  }

  return {
    tick,
    snapshot,
    redisBackend: force ? 'none' : 'redis',
    debounced: false,
  };
}
