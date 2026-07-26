/**
 * Event-level playback mode selection + audited fallback (PRD-07).
 * Prefers events.playback_mode; falls back to user_settings for readiness
 * before an organiser control event exists.
 */

import { getPool } from '@/lib/db';
import { emitSecurityAudit } from '@/lib/auth/security-audit';
import type { PlaybackMode } from './types';

const VALID_MODES = new Set<PlaybackMode>(['spotify', 'manual']);

export function isPlaybackMode(value: unknown): value is PlaybackMode {
  return typeof value === 'string' && VALID_MODES.has(value as PlaybackMode);
}

export async function getPlaybackMode(userId: string): Promise<PlaybackMode> {
  const pool = getPool();

  const eventResult = await pool.query(
    `SELECT playback_mode
     FROM events
     WHERE user_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [userId]
  );
  const eventMode = eventResult.rows[0]?.playback_mode;
  if (isPlaybackMode(eventMode)) return eventMode;

  const settingsResult = await pool.query(
    `SELECT playback_mode
     FROM user_settings
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  const settingsMode = settingsResult.rows[0]?.playback_mode;
  return isPlaybackMode(settingsMode) ? settingsMode : 'spotify';
}

/**
 * Switch provider/mode. Non-destructive: does not delete or re-queue requests.
 * Switching back to Spotify does NOT auto re-queue approved items.
 */
export async function setPlaybackMode(
  userId: string,
  mode: PlaybackMode,
  options?: { username?: string; reason?: string }
): Promise<{ mode: PlaybackMode; previous: PlaybackMode; eventId: string | null }> {
  if (!isPlaybackMode(mode)) {
    throw new Error('Invalid playback mode');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const previous = await (async (): Promise<PlaybackMode> => {
      const eventRow = await client.query(
        `SELECT id, playback_mode
         FROM events
         WHERE user_id = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );
      if (isPlaybackMode(eventRow.rows[0]?.playback_mode)) {
        return eventRow.rows[0].playback_mode as PlaybackMode;
      }
      const settingsRow = await client.query(
        `SELECT playback_mode FROM user_settings WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      return isPlaybackMode(settingsRow.rows[0]?.playback_mode)
        ? (settingsRow.rows[0].playback_mode as PlaybackMode)
        : 'spotify';
    })();

    const eventRow = await client.query(
      `SELECT id FROM events
       WHERE user_id = $1
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [userId]
    );
    const eventId = (eventRow.rows[0]?.id as string | undefined) ?? null;

    if (eventId) {
      await client.query(
        `UPDATE events
         SET playback_mode = $2, updated_at = NOW()
         WHERE id = $1 AND user_id = $3`,
        [eventId, mode, userId]
      );
    }

    await client.query(
      `UPDATE user_events
       SET playback_mode = $2, updated_at = NOW()
       WHERE user_id = $1 AND active = true`,
      [userId, mode]
    );

    await client.query(
      `INSERT INTO user_settings (user_id, playback_mode)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET playback_mode = EXCLUDED.playback_mode, updated_at = NOW()`,
      [userId, mode]
    );

    await client.query('COMMIT');

    if (previous !== mode) {
      emitSecurityAudit('playback.mode_changed', {
        userId,
        eventId: eventId ?? undefined,
        meta: {
          from: previous,
          to: mode,
          reason: options?.reason ?? 'organiser',
          username: options?.username ?? null,
        },
      });
    }

    return { mode, previous, eventId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
