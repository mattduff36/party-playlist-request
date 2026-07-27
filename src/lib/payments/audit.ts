/**
 * Party Pass audit + funnel events (PRD-09). No card data.
 */

import { getPool } from '@/lib/db';
import { emitSecurityAudit } from '@/lib/auth/security-audit';

export type PartyPassAuditAction =
  | 'checkout_created'
  | 'purchase_paid'
  | 'purchase_failed'
  | 'purchase_cancelled'
  | 'pass_activated'
  | 'pass_expired'
  | 'refund_recorded'
  | 'dispute_recorded'
  | 'webhook_ignored'
  | 'webhook_failed';

export type PartyPassFunnelEventName =
  | 'pricing_viewed'
  | 'checkout_started'
  | 'purchase_completed'
  | 'pass_activated'
  | 'event_ready'
  | 'event_started'
  | 'event_ended'
  | 'refund_requested'
  | 'refund_completed';

export async function recordPartyPassAudit(input: {
  action: PartyPassAuditAction;
  userId?: string | null;
  purchaseId?: string | null;
  entitlementId?: string | null;
  actorId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO party_pass_audit
       (user_id, purchase_id, entitlement_id, action, actor_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.userId ?? null,
      input.purchaseId ?? null,
      input.entitlementId ?? null,
      input.action,
      input.actorId ?? null,
      JSON.stringify(input.meta ?? {}),
    ]
  );

  emitSecurityAudit(
    input.action === 'pass_activated'
      ? 'party_pass.activated'
      : input.action === 'checkout_created'
        ? 'party_pass.checkout_created'
        : input.action === 'purchase_paid'
          ? 'party_pass.purchase_paid'
          : input.action.startsWith('refund')
            ? 'party_pass.refund'
            : input.action.startsWith('dispute')
              ? 'party_pass.dispute'
              : 'party_pass.audit',
    {
      userId: input.userId ?? undefined,
      meta: {
        action: input.action,
        purchaseId: input.purchaseId ?? null,
        entitlementId: input.entitlementId ?? null,
      },
    }
  );
}

export async function recordFunnelEvent(input: {
  eventName: PartyPassFunnelEventName;
  userId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO party_pass_funnel_events (user_id, event_name, meta)
     VALUES ($1, $2, $3::jsonb)`,
    [
      input.userId ?? null,
      input.eventName,
      JSON.stringify(input.meta ?? {}),
    ]
  );
}
