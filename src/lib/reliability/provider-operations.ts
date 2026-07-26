/**
 * Durable provider operation ledger for uncertain Spotify queue calls (PRD-06).
 */

import { randomUUID } from 'crypto';
import { getPool } from '@/lib/db';

export type ProviderOpStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'uncertain';

export interface ProviderOperation {
  id: string;
  user_id: string;
  event_id: string | null;
  request_id: string | null;
  provider: string;
  operation: string;
  status: ProviderOpStatus;
  idempotency_key: string | null;
  error_category: string | null;
  provider_ref: string | null;
}

export async function findProviderOperationByIdempotency(
  userId: string,
  operation: string,
  idempotencyKey: string
): Promise<ProviderOperation | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, event_id, request_id, provider, operation, status,
            idempotency_key, error_category, provider_ref
     FROM provider_operations
     WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3
     LIMIT 1`,
    [userId, operation, idempotencyKey]
  );
  return (result.rows[0] as ProviderOperation) || null;
}

export async function createProviderOperation(input: {
  userId: string;
  eventId?: string | null;
  requestId?: string | null;
  operation: string;
  idempotencyKey: string;
  provider?: string;
}): Promise<ProviderOperation> {
  const pool = getPool();
  const id = randomUUID();
  try {
    const result = await pool.query(
      `INSERT INTO provider_operations (
         id, user_id, event_id, request_id, provider, operation, status, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id, user_id, event_id, request_id, provider, operation, status,
                 idempotency_key, error_category, provider_ref`,
      [
        id,
        input.userId,
        input.eventId ?? null,
        input.requestId ?? null,
        input.provider ?? 'spotify',
        input.operation,
        input.idempotencyKey,
      ]
    );
    return result.rows[0] as ProviderOperation;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== '23505') throw error;
    const existing = await findProviderOperationByIdempotency(
      input.userId,
      input.operation,
      input.idempotencyKey
    );
    if (!existing) {
      throw new Error('Failed to create or load provider operation');
    }
    return existing;
  }
}

export async function completeProviderOperation(
  id: string,
  status: ProviderOpStatus,
  errorCategory?: string | null
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE provider_operations
     SET status = $2,
         error_category = $3,
         completed_at = CASE WHEN $2 IN ('succeeded', 'failed') THEN NOW() ELSE completed_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, status, errorCategory ?? null]
  );
}

/**
 * Whether a ledger row may safely call Spotify add-to-queue again.
 * `uncertain` must never re-enqueue (response may have succeeded).
 */
export function shouldAttemptSpotifyQueueAdd(status: ProviderOpStatus): boolean {
  return status === 'pending' || status === 'failed';
}

export function classifySpotifyQueueError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return 'provider_auth';
  }
  if (lower.includes('403') || lower.includes('development')) {
    return 'provider_denied';
  }
  if (lower.includes('429') || lower.includes('rate')) {
    return 'rate_limited';
  }
  if (lower.includes('no active device') || lower.includes('device')) {
    return 'no_active_device';
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return 'uncertain_timeout';
  }
  return 'provider_unavailable';
}
