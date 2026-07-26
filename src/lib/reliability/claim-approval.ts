/**
 * Atomic approval claim: pending|rejected|queue_failed → approving (PRD-06).
 */

import { getPool, type Request } from '@/lib/db';

export type ClaimableStatus = 'pending' | 'rejected' | 'queue_failed';

/**
 * Atomically claim a request for approval work.
 * Returns the claimed row, or null if another worker won / wrong state.
 */
export async function claimRequestForApproval(
  requestId: string,
  userId: string
): Promise<Request | null> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE requests
     SET status = 'approving'
     WHERE id = $1
       AND user_id = $2
       AND status IN ('pending', 'rejected', 'queue_failed', 'failed')
     RETURNING *`,
    [requestId, userId]
  );
  return (result.rows[0] as Request) || null;
}

export async function getRequestCurrentStatus(
  requestId: string,
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT status FROM requests WHERE id = $1 AND user_id = $2`,
    [requestId, userId]
  );
  return result.rows[0]?.status ?? null;
}
