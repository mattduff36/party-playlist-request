/**
 * App-owned approved-request queue (PRD-07).
 * Ordering is PartyPlaylist's, independent of any provider opaque queue.
 */

import { getPool, type Request } from '@/lib/db';

export interface ReorderResult {
  ok: boolean;
  code?: string;
  message?: string;
  requests?: Request[];
  queueVersion?: number;
}

/**
 * Assign the next queue_position when a request is approved.
 */
export async function assignNextQueuePosition(
  userId: string,
  requestId: string
): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const maxRow = await client.query(
      `SELECT COALESCE(MAX(queue_position), 0) AS max_pos
       FROM requests
       WHERE user_id = $1
         AND status IN ('approved', 'queued', 'approving')
         AND archived_at IS NULL
       FOR UPDATE`,
      [userId]
    );
    const next = Number(maxRow.rows[0]?.max_pos ?? 0) + 1;
    await client.query(
      `UPDATE requests
       SET queue_position = $3,
           queue_version = COALESCE(queue_version, 0) + 1
       WHERE id = $1 AND user_id = $2`,
      [requestId, userId, next]
    );
    await client.query('COMMIT');
    return next;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Version-safe reorder of approved app-owned queue.
 * `orderedIds` is the full desired order of approved request IDs.
 */
export async function reorderAppOwnedQueue(
  userId: string,
  orderedIds: string[],
  expectedVersion?: number
): Promise<ReorderResult> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return {
      ok: false,
      code: 'INVALID_ORDER',
      message: 'orderedIds must be a non-empty array of request ids',
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT id, queue_position, queue_version, status
       FROM requests
       WHERE user_id = $1
         AND status IN ('approved', 'queued')
         AND archived_at IS NULL
       ORDER BY queue_position NULLS LAST, approved_at NULLS LAST, created_at
       FOR UPDATE`,
      [userId]
    );

    const rows = current.rows as Array<{
      id: string;
      queue_position: number | null;
      queue_version: number | null;
      status: string;
    }>;

    const currentIds = new Set(rows.map((r) => r.id));
    if (
      orderedIds.length !== currentIds.size ||
      orderedIds.some((id) => !currentIds.has(id))
    ) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'ORDER_MISMATCH',
        message:
          'orderedIds must include exactly the current approved queue members',
      };
    }

    const maxVersion = rows.reduce(
      (max, r) => Math.max(max, Number(r.queue_version ?? 0)),
      0
    );

    if (
      typeof expectedVersion === 'number' &&
      expectedVersion !== maxVersion
    ) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'VERSION_CONFLICT',
        message: 'Queue was modified concurrently; refresh and retry',
      };
    }

    const nextVersion = maxVersion + 1;
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE requests
         SET queue_position = $3, queue_version = $4
         WHERE id = $1 AND user_id = $2`,
        [orderedIds[i], userId, i + 1, nextVersion]
      );
    }

    const updated = await client.query(
      `SELECT *
       FROM requests
       WHERE user_id = $1
         AND status IN ('approved', 'queued')
         AND archived_at IS NULL
       ORDER BY queue_position NULLS LAST, approved_at NULLS LAST, created_at`,
      [userId]
    );

    await client.query('COMMIT');
    return {
      ok: true,
      requests: updated.rows as Request[],
      queueVersion: nextVersion,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listAppOwnedQueue(userId: string): Promise<Request[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT *
     FROM requests
     WHERE user_id = $1
       AND status IN ('approved', 'queued')
       AND archived_at IS NULL
     ORDER BY queue_position NULLS LAST, approved_at NULLS LAST, created_at`,
    [userId]
  );
  return result.rows as Request[];
}
