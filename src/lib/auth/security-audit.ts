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
  | 'event.end';

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
