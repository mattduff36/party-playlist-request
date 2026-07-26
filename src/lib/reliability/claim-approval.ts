/**
 * Atomic approval claim: pending|rejected|queue_failed → approving (PRD-06).
 * Stuck `approving` rows can be reclaimed after timeout; error paths must release.
 */

import { getPool, type Request } from '@/lib/db';

export type ClaimableStatus = 'pending' | 'rejected' | 'queue_failed';

/** How long an `approving` claim may sit before another worker can reclaim it. */
export const APPROVAL_CLAIM_TIMEOUT_MS = 120_000;

export type ReleaseApprovalStatus = 'pending' | 'queue_failed';

/**
 * Atomically claim a request for approval work.
 * Returns the claimed row, or null if another worker won / wrong state.
 * Reclaims stuck `approving` after APPROVAL_CLAIM_TIMEOUT_MS.
 */
export async function claimRequestForApproval(
  requestId: string,
  userId: string,
  options: { timeoutMs?: number } = {}
): Promise<Request | null> {
  const pool = getPool();
  const timeoutMs = options.timeoutMs ?? APPROVAL_CLAIM_TIMEOUT_MS;
  const result = await pool.query(
    `UPDATE requests
     SET status = 'approving',
         claim_started_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND (
         status IN ('pending', 'rejected', 'queue_failed', 'failed')
         OR (
           status = 'approving'
           AND (
             claim_started_at IS NULL
             OR claim_started_at < NOW() - ($3::double precision * INTERVAL '1 millisecond')
           )
         )
       )
     RETURNING *`,
    [requestId, userId, timeoutMs]
  );
  return (result.rows[0] as Request) || null;
}

/**
 * Clear an `approving` claim after failure/crash so the request is not stuck.
 */
export async function releaseApprovalClaim(
  requestId: string,
  userId: string,
  toStatus: ReleaseApprovalStatus = 'queue_failed'
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE requests
     SET status = $3,
         claim_started_at = NULL
     WHERE id = $1
       AND user_id = $2
       AND status = 'approving'
     RETURNING id`,
    [requestId, userId, toStatus]
  );
  return (result.rowCount ?? 0) > 0;
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
