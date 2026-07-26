/**
 * Minimal structured security audit events (PRD-02).
 * No passwords, tokens, codes, full IPs, or sensitive bodies.
 */

import { randomUUID } from 'crypto';

export type SecurityAuditEventType =
  | 'auth.login_success'
  | 'auth.login_failure'
  | 'auth.session_transfer'
  | 'auth.session_revoked'
  | 'auth.password_reset_complete'
  | 'auth.logout'
  | 'auth.superadmin_access'
  | 'event.end'
  | 'event.archived_data_deleted'
  | 'event.readiness_ready'
  | 'event.template_applied'
  | 'event.guardrail_override'
  | 'beta.entitlement_grant'
  | 'beta.entitlement_revoke'
  | 'playback.mode_changed'
  | 'party_pass.checkout_created'
  | 'party_pass.purchase_paid'
  | 'party_pass.activated'
  | 'party_pass.refund'
  | 'party_pass.dispute'
  | 'party_pass.audit';

export interface SecurityAuditEvent {
  type: SecurityAuditEventType;
  timestamp: string;
  correlationId: string;
  userId?: string;
  eventId?: string;
  meta?: Record<string, string | number | boolean | null>;
}

/**
 * Emit a structured audit line. Prefer stdout JSON for log drains;
 * never include secrets.
 */
export function emitSecurityAudit(
  type: SecurityAuditEventType,
  options?: {
    correlationId?: string;
    userId?: string;
    eventId?: string;
    meta?: Record<string, string | number | boolean | null>;
  }
): SecurityAuditEvent {
  const event: SecurityAuditEvent = {
    type,
    timestamp: new Date().toISOString(),
    correlationId: options?.correlationId || randomUUID(),
    userId: options?.userId,
    eventId: options?.eventId,
    meta: options?.meta,
  };

  console.info('[security-audit]', JSON.stringify(event));
  return event;
}

export function newCorrelationId(): string {
  return randomUUID();
}
