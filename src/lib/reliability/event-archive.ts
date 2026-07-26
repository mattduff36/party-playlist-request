/**
 * Event end archive — freeze request set without destructive deletes (PRD-06).
 */

import { getPool } from '@/lib/db';

export interface ArchiveEventResult {
  eventId: string;
  archivedRequests: number;
}

/**
 * Mark organiser event ended/archived and stamp its active requests.
 * Does not DELETE request rows.
 */
export async function archiveEventOnEnd(
  userId: string,
  eventId: string
): Promise<ArchiveEventResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE events
       SET archived_at = COALESCE(archived_at, NOW()),
           ended_at = COALESCE(ended_at, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [eventId, userId]
    );

    const stamped = await client.query(
      `UPDATE requests
       SET archived_at = COALESCE(archived_at, NOW()),
           event_id = COALESCE(event_id, $1)
       WHERE user_id = $2
         AND archived_at IS NULL
         AND (
           event_id = $1
           OR (event_id IS NULL AND status IN ('pending', 'approved', 'approving', 'rejected', 'played', 'queue_failed', 'failed'))
         )
       RETURNING id`,
      [eventId, userId]
    );

    await client.query('COMMIT');
    return {
      eventId,
      archivedRequests: stamped.rowCount ?? stamped.rows.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export interface EventSummary {
  eventId: string;
  totals: {
    requests: number;
    pending: number;
    approved: number;
    rejected: number;
    played: number;
    queueFailed: number;
  };
  topTracks: Array<{ track_name: string; artist_name: string; count: number }>;
  topArtists: Array<{ artist_name: string; count: number }>;
}

export async function getEventSummary(
  userId: string,
  eventId: string
): Promise<EventSummary> {
  const pool = getPool();
  const totals = await pool.query(
    `SELECT
       COUNT(*)::int AS requests,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
       COUNT(*) FILTER (WHERE status = 'played')::int AS played,
       COUNT(*) FILTER (WHERE status IN ('queue_failed', 'failed'))::int AS queue_failed
     FROM requests
     WHERE user_id = $1 AND (event_id = $2 OR (event_id IS NULL AND archived_at IS NOT NULL))`,
    [userId, eventId]
  );

  const topTracks = await pool.query(
    `SELECT track_name, artist_name, COUNT(*)::int AS count
     FROM requests
     WHERE user_id = $1 AND event_id = $2
     GROUP BY track_name, artist_name
     ORDER BY count DESC
     LIMIT 10`,
    [userId, eventId]
  );

  const topArtists = await pool.query(
    `SELECT artist_name, COUNT(*)::int AS count
     FROM requests
     WHERE user_id = $1 AND event_id = $2
     GROUP BY artist_name
     ORDER BY count DESC
     LIMIT 10`,
    [userId, eventId]
  );

  const t = totals.rows[0] || {};
  return {
    eventId,
    totals: {
      requests: t.requests ?? 0,
      pending: t.pending ?? 0,
      approved: t.approved ?? 0,
      rejected: t.rejected ?? 0,
      played: t.played ?? 0,
      queueFailed: t.queue_failed ?? 0,
    },
    topTracks: topTracks.rows,
    topArtists: topArtists.rows,
  };
}
