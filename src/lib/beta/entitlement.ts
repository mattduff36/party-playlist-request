/**
 * Beta entitlement grants (PRD-08) — gate event activation, not history reads.
 */

import { getPool } from '@/lib/db';

export type BetaEntitlementStatus = 'active' | 'revoked' | 'expired';

export interface BetaEntitlement {
  id: string;
  user_id: string;
  source: string;
  status: BetaEntitlementStatus;
  starts_at: string;
  ends_at: string | null;
  granted_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  reason: 'ok' | 'missing' | 'expired' | 'revoked' | 'not_started' | 'superadmin_bypass';
  entitlement: BetaEntitlement | null;
}

function rowToEntitlement(row: Record<string, unknown>): BetaEntitlement {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    source: String(row.source),
    status: row.status as BetaEntitlementStatus,
    starts_at: new Date(row.starts_at as string | Date).toISOString(),
    ends_at: row.ends_at
      ? new Date(row.ends_at as string | Date).toISOString()
      : null,
    granted_by: row.granted_by ? String(row.granted_by) : null,
    notes: row.notes != null ? String(row.notes) : null,
    created_at: new Date(row.created_at as string | Date).toISOString(),
    updated_at: new Date(row.updated_at as string | Date).toISOString(),
  };
}

/**
 * When true, entitlement checks are skipped.
 * - Explicit `BETA_ENTITLEMENT_BYPASS=1`
 * - Non-production unless `BETA_ENTITLEMENT_ENFORCE=1` (local convenience)
 * Production always enforces unless explicit bypass (do not set in prod).
 */
export function isBetaEntitlementBypassEnabled(): boolean {
  if (process.env.BETA_ENTITLEMENT_BYPASS === '1') return true;
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.BETA_ENTITLEMENT_ENFORCE !== '1'
  ) {
    return true;
  }
  return false;
}

export async function getActiveEntitlement(
  userId: string,
  at: Date = new Date()
): Promise<BetaEntitlement | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM beta_entitlements
     WHERE user_id = $1
       AND status = 'active'
       AND starts_at <= $2
       AND (ends_at IS NULL OR ends_at > $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, at.toISOString()]
  );
  if (!result.rows[0]) return null;
  return rowToEntitlement(result.rows[0]);
}

/**
 * Server-side gate for starting/activating an event (offline → standby/live).
 * Superadmins always pass. Historical / offline reads are never gated here.
 */
export async function assertCanActivateEvent(options: {
  userId: string;
  isSuperAdmin?: boolean;
  at?: Date;
}): Promise<EntitlementCheckResult> {
  if (options.isSuperAdmin) {
    return { allowed: true, reason: 'superadmin_bypass', entitlement: null };
  }
  if (isBetaEntitlementBypassEnabled()) {
    return { allowed: true, reason: 'ok', entitlement: null };
  }

  const at = options.at ?? new Date();
  const pool = getPool();

  // Expire stale active rows opportunistically (no Class C backfill of secrets).
  await pool.query(
    `UPDATE beta_entitlements
     SET status = 'expired', updated_at = NOW()
     WHERE user_id = $1
       AND status = 'active'
       AND ends_at IS NOT NULL
       AND ends_at <= $2`,
    [options.userId, at.toISOString()]
  );

  const latest = await pool.query(
    `SELECT * FROM beta_entitlements
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [options.userId]
  );

  if (!latest.rows[0]) {
    return { allowed: false, reason: 'missing', entitlement: null };
  }

  const entitlement = rowToEntitlement(latest.rows[0]);
  if (entitlement.status === 'revoked') {
    return { allowed: false, reason: 'revoked', entitlement };
  }
  if (entitlement.status === 'expired') {
    return { allowed: false, reason: 'expired', entitlement };
  }

  const starts = new Date(entitlement.starts_at).getTime();
  if (starts > at.getTime()) {
    return { allowed: false, reason: 'not_started', entitlement };
  }
  if (entitlement.ends_at && new Date(entitlement.ends_at).getTime() <= at.getTime()) {
    return { allowed: false, reason: 'expired', entitlement };
  }

  return { allowed: true, reason: 'ok', entitlement };
}

export async function grantBetaEntitlement(input: {
  userId: string;
  grantedBy: string;
  days?: number;
  endsAt?: string | null;
  notes?: string | null;
  source?: string;
}): Promise<BetaEntitlement> {
  const pool = getPool();
  const endsAt =
    input.endsAt !== undefined
      ? input.endsAt
      : new Date(
          Date.now() + (input.days ?? 30) * 24 * 60 * 60 * 1000
        ).toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE beta_entitlements
       SET status = 'revoked', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [input.userId]
    );

    const inserted = await client.query(
      `INSERT INTO beta_entitlements
         (user_id, source, status, starts_at, ends_at, granted_by, notes)
       VALUES ($1, $2, 'active', NOW(), $3, $4, $5)
       RETURNING *`,
      [
        input.userId,
        input.source ?? 'superadmin_grant',
        endsAt,
        input.grantedBy,
        input.notes ?? null,
      ]
    );

    const entitlement = rowToEntitlement(inserted.rows[0]);
    await client.query(
      `INSERT INTO beta_entitlement_audit
         (entitlement_id, user_id, action, actor_id, meta)
       VALUES ($1, $2, 'grant', $3, $4::jsonb)`,
      [
        entitlement.id,
        input.userId,
        input.grantedBy,
        JSON.stringify({ ends_at: endsAt, source: entitlement.source }),
      ]
    );
    await client.query('COMMIT');
    return entitlement;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeBetaEntitlement(input: {
  userId: string;
  actorId: string;
  reason?: string;
}): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE beta_entitlements
     SET status = 'revoked', updated_at = NOW()
     WHERE user_id = $1 AND status = 'active'
     RETURNING id`,
    [input.userId]
  );
  if (!result.rows[0]) return false;

  await pool.query(
    `INSERT INTO beta_entitlement_audit
       (entitlement_id, user_id, action, actor_id, meta)
     VALUES ($1, $2, 'revoke', $3, $4::jsonb)`,
    [
      result.rows[0].id,
      input.userId,
      input.actorId,
      JSON.stringify({ reason: input.reason ?? null }),
    ]
  );
  return true;
}

export async function listEntitlementsForUser(
  userId: string
): Promise<BetaEntitlement[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM beta_entitlements
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows.map((row) => rowToEntitlement(row));
}
