/**
 * Party Pass entitlement service (PRD-09).
 * Purchase ≠ activated. Activation starts the 30-day window.
 * Super-admin beta grants continue via PRD-08 beta_entitlements under the same gate.
 */

import { getPool } from '@/lib/db';
import {
  PARTY_PASS_ACTIVE_DAYS,
  PARTY_PASS_USE_BY_DAYS,
} from '@/lib/payments/config';
import { recordFunnelEvent, recordPartyPassAudit } from '@/lib/payments/audit';
import {
  assertCanActivateEvent as assertBetaCanActivateEvent,
  getActiveEntitlement as getActiveBetaEntitlement,
  isBetaEntitlementBypassEnabled,
  type EntitlementCheckResult as BetaEntitlementCheckResult,
} from '@/lib/beta/entitlement';

export type PartyPassEntitlementStatus =
  | 'purchased'
  | 'activated'
  | 'expired'
  | 'revoked'
  | 'refunded'
  | 'disputed';

export interface PartyPassEntitlement {
  id: string;
  purchase_id: string;
  user_id: string;
  status: PartyPassEntitlementStatus;
  purchased_at: string;
  use_by_at: string;
  activated_at: string | null;
  starts_at: string | null;
  expires_at: string | null;
  linked_event_id: string | null;
  source: string;
}

export type UnifiedEntitlementReason =
  | 'ok'
  | 'missing'
  | 'expired'
  | 'revoked'
  | 'not_started'
  | 'use_by_elapsed'
  | 'unactivated'
  | 'refunded'
  | 'disputed'
  | 'superadmin_bypass'
  | 'beta_grant'
  | 'party_pass_active';

export interface UnifiedEntitlementResult {
  allowed: boolean;
  reason: UnifiedEntitlementReason;
  source: 'party_pass' | 'beta' | 'bypass' | 'none';
  partyPass: PartyPassEntitlement | null;
  beta: BetaEntitlementCheckResult['entitlement'];
}

function rowToEntitlement(row: Record<string, unknown>): PartyPassEntitlement {
  return {
    id: String(row.id),
    purchase_id: String(row.purchase_id),
    user_id: String(row.user_id),
    status: row.status as PartyPassEntitlementStatus,
    purchased_at: new Date(row.purchased_at as string | Date).toISOString(),
    use_by_at: new Date(row.use_by_at as string | Date).toISOString(),
    activated_at: row.activated_at
      ? new Date(row.activated_at as string | Date).toISOString()
      : null,
    starts_at: row.starts_at
      ? new Date(row.starts_at as string | Date).toISOString()
      : null,
    expires_at: row.expires_at
      ? new Date(row.expires_at as string | Date).toISOString()
      : null,
    linked_event_id: row.linked_event_id ? String(row.linked_event_id) : null,
    source: String(row.source),
  };
}

export function computeUseByAt(
  purchasedAt: Date,
  useByDays: number = PARTY_PASS_USE_BY_DAYS
): Date {
  return new Date(purchasedAt.getTime() + useByDays * 24 * 60 * 60 * 1000);
}

export function computeExpiresAt(
  startsAt: Date,
  activeDays: number = PARTY_PASS_ACTIVE_DAYS
): Date {
  return new Date(startsAt.getTime() + activeDays * 24 * 60 * 60 * 1000);
}

/** Opportunistically mark activated passes past expires_at as expired. */
export async function expireStalePartyPasses(
  userId: string,
  at: Date = new Date()
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE party_pass_entitlements
     SET status = 'expired', updated_at = NOW()
     WHERE user_id = $1
       AND status = 'activated'
       AND expires_at IS NOT NULL
       AND expires_at <= $2
     RETURNING id`,
    [userId, at.toISOString()]
  );
  return result.rowCount ?? 0;
}

export async function getEligibleUnactivatedPass(
  userId: string,
  at: Date = new Date()
): Promise<PartyPassEntitlement | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT e.*
     FROM party_pass_entitlements e
     INNER JOIN party_pass_purchases p ON p.id = e.purchase_id
     WHERE e.user_id = $1
       AND e.status = 'purchased'
       AND e.use_by_at > $2
       AND p.payment_status = 'paid'
     ORDER BY e.purchased_at ASC
     LIMIT 1`,
    [userId, at.toISOString()]
  );
  if (!result.rows[0]) return null;
  return rowToEntitlement(result.rows[0]);
}

export async function getActivePartyPass(
  userId: string,
  at: Date = new Date()
): Promise<PartyPassEntitlement | null> {
  await expireStalePartyPasses(userId, at);
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM party_pass_entitlements
     WHERE user_id = $1
       AND status = 'activated'
       AND starts_at IS NOT NULL
       AND starts_at <= $2
       AND expires_at IS NOT NULL
       AND expires_at > $2
     ORDER BY activated_at DESC
     LIMIT 1`,
    [userId, at.toISOString()]
  );
  if (!result.rows[0]) return null;
  return rowToEntitlement(result.rows[0]);
}

export async function listPartyPassEntitlementsForUser(
  userId: string
): Promise<PartyPassEntitlement[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM party_pass_entitlements
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows.map((row) => rowToEntitlement(row));
}

export async function getPartyPassEntitlementByIdForUser(
  entitlementId: string,
  userId: string
): Promise<PartyPassEntitlement | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM party_pass_entitlements
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [entitlementId, userId]
  );
  if (!result.rows[0]) return null;
  return rowToEntitlement(result.rows[0]);
}

/**
 * Explicit activation: sets starts_at / expires_at (+30d) in one transaction.
 * Cannot re-activate or move without support flow.
 */
export async function activatePartyPass(input: {
  userId: string;
  entitlementId: string;
  eventId?: string | null;
  actorId?: string | null;
  at?: Date;
}): Promise<PartyPassEntitlement> {
  const at = input.at ?? new Date();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingActive = await client.query(
      `SELECT id FROM party_pass_entitlements
       WHERE user_id = $1
         AND status = 'activated'
         AND expires_at IS NOT NULL
         AND expires_at > $2
       FOR UPDATE`,
      [input.userId, at.toISOString()]
    );
    if (existingActive.rows[0]) {
      throw new PartyPassActivationError(
        'An active Party Pass is already in use',
        'ALREADY_ACTIVE'
      );
    }

    const locked = await client.query(
      `SELECT e.*, p.payment_status
       FROM party_pass_entitlements e
       INNER JOIN party_pass_purchases p ON p.id = e.purchase_id
       WHERE e.id = $1 AND e.user_id = $2
       FOR UPDATE OF e`,
      [input.entitlementId, input.userId]
    );
    const row = locked.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new PartyPassActivationError('Party Pass not found', 'NOT_FOUND');
    }
    if (String(row.payment_status) !== 'paid') {
      throw new PartyPassActivationError(
        'Purchase is not paid',
        'NOT_PAID'
      );
    }
    if (String(row.status) !== 'purchased') {
      throw new PartyPassActivationError(
        'Party Pass is not eligible for activation',
        'INVALID_STATUS'
      );
    }
    const useBy = new Date(row.use_by_at as string | Date);
    if (useBy.getTime() <= at.getTime()) {
      throw new PartyPassActivationError(
        'Party Pass use-by date has elapsed',
        'USE_BY_ELAPSED'
      );
    }

    const startsAt = at;
    const expiresAt = computeExpiresAt(startsAt);

    const updated = await client.query(
      `UPDATE party_pass_entitlements
       SET status = 'activated',
           activated_at = $3,
           starts_at = $3,
           expires_at = $4,
           linked_event_id = COALESCE($5::uuid, linked_event_id),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'purchased'
       RETURNING *`,
      [
        input.entitlementId,
        input.userId,
        startsAt.toISOString(),
        expiresAt.toISOString(),
        input.eventId ?? null,
      ]
    );

    if (!updated.rows[0]) {
      throw new PartyPassActivationError(
        'Activation conflict — retry',
        'CONFLICT'
      );
    }

    await client.query('COMMIT');
    const entitlement = rowToEntitlement(updated.rows[0]);

    await recordPartyPassAudit({
      action: 'pass_activated',
      userId: input.userId,
      purchaseId: entitlement.purchase_id,
      entitlementId: entitlement.id,
      actorId: input.actorId ?? input.userId,
      meta: {
        starts_at: entitlement.starts_at,
        expires_at: entitlement.expires_at,
        linked_event_id: entitlement.linked_event_id,
      },
    });
    await recordFunnelEvent({
      eventName: 'pass_activated',
      userId: input.userId,
      meta: { entitlement_id: entitlement.id },
    });

    return entitlement;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class PartyPassActivationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PartyPassActivationError';
    this.code = code;
  }
}

/**
 * Unified gate used by event activation routes.
 * Allows: active Party Pass OR PRD-08 beta grant OR bypass/superadmin.
 * History / offline reads are never gated here.
 */
export async function assertCanActivatePaidEvent(options: {
  userId: string;
  isSuperAdmin?: boolean;
  at?: Date;
}): Promise<UnifiedEntitlementResult> {
  if (options.isSuperAdmin) {
    return {
      allowed: true,
      reason: 'superadmin_bypass',
      source: 'bypass',
      partyPass: null,
      beta: null,
    };
  }

  if (isBetaEntitlementBypassEnabled()) {
    return {
      allowed: true,
      reason: 'ok',
      source: 'bypass',
      partyPass: null,
      beta: null,
    };
  }

  const at = options.at ?? new Date();
  const activePass = await getActivePartyPass(options.userId, at);
  if (activePass) {
    return {
      allowed: true,
      reason: 'party_pass_active',
      source: 'party_pass',
      partyPass: activePass,
      beta: null,
    };
  }

  const beta = await assertBetaCanActivateEvent({
    userId: options.userId,
    isSuperAdmin: false,
    at,
  });
  if (beta.allowed) {
    return {
      allowed: true,
      reason: 'beta_grant',
      source: 'beta',
      partyPass: null,
      beta: beta.entitlement,
    };
  }

  const unactivated = await getEligibleUnactivatedPass(options.userId, at);
  if (unactivated) {
    return {
      allowed: false,
      reason: 'unactivated',
      source: 'party_pass',
      partyPass: unactivated,
      beta: null,
    };
  }

  const anyPass = (await listPartyPassEntitlementsForUser(options.userId))[0];
  if (anyPass?.status === 'refunded') {
    return {
      allowed: false,
      reason: 'refunded',
      source: 'party_pass',
      partyPass: anyPass,
      beta: null,
    };
  }
  if (anyPass?.status === 'disputed') {
    return {
      allowed: false,
      reason: 'disputed',
      source: 'party_pass',
      partyPass: anyPass,
      beta: null,
    };
  }
  if (anyPass?.status === 'expired') {
    return {
      allowed: false,
      reason: 'expired',
      source: 'party_pass',
      partyPass: anyPass,
      beta: null,
    };
  }

  return {
    allowed: false,
    reason: beta.reason === 'missing' ? 'missing' : (beta.reason as UnifiedEntitlementReason),
    source: 'none',
    partyPass: null,
    beta: beta.entitlement,
  };
}

/** Account summary for UI (never includes card data). */
export async function getPartyPassAccountSummary(userId: string): Promise<{
  checkoutEnabled: boolean;
  active: PartyPassEntitlement | null;
  unactivated: PartyPassEntitlement | null;
  history: PartyPassEntitlement[];
  betaActive: boolean;
  canStartEvent: boolean;
  reason: UnifiedEntitlementReason;
}> {
  const { isPartyPassCheckoutEnabled } = await import('@/lib/payments/config');
  const gate = await assertCanActivatePaidEvent({ userId });
  const unactivated = await getEligibleUnactivatedPass(userId);
  const history = await listPartyPassEntitlementsForUser(userId);
  const beta = await getActiveBetaEntitlement(userId);

  return {
    checkoutEnabled: isPartyPassCheckoutEnabled(),
    active: gate.source === 'party_pass' && gate.allowed ? gate.partyPass : null,
    unactivated,
    history,
    betaActive: Boolean(beta),
    canStartEvent: gate.allowed,
    reason: gate.reason,
  };
}
