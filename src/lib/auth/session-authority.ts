/**
 * Authoritative session validation (PRD-02).
 * JWT signature alone is insufficient — session_id must match users.active_session_id.
 */

import { sql } from '@/lib/db/neon-client';
import type { JWTPayload } from '@/lib/auth';

export interface SessionUserRecord {
  id: string;
  username: string;
  email: string;
  role: string;
  active_session_id: string | null;
  account_status: string;
  email_verified: boolean;
}

export type SessionAuthorityFailureCode =
  | 'NO_TOKEN'
  | 'INVALID_TOKEN'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_INACTIVE';

/**
 * Load the canonical user/session row used for authority checks.
 */
export async function loadSessionUser(
  userId: string
): Promise<SessionUserRecord | null> {
  const rows = await sql`
    SELECT id, username, email, role, active_session_id, account_status, email_verified
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as SessionUserRecord | undefined;
  return row ?? null;
}

/**
 * Exact active-session equality. Missing JWT session_id never matches a locked session.
 */
export function isActiveSession(
  tokenSessionId: string | undefined,
  activeSessionId: string | null | undefined
): boolean {
  if (!tokenSessionId || !activeSessionId) {
    return false;
  }
  return tokenSessionId === activeSessionId;
}

export function isAccountAllowed(record: SessionUserRecord): boolean {
  const status = (record.account_status || 'active').toLowerCase();
  if (status === 'disabled' || status === 'deleted' || status === 'banned') {
    return false;
  }
  // Unverified accounts are rejected for organiser APIs (product rule).
  if (record.email_verified === false) {
    return false;
  }
  return status === 'active';
}

export interface SessionAuthorityResult {
  ok: true;
  user: JWTPayload;
  record: SessionUserRecord;
  sessionId: string;
  correlationId: string;
}

export interface SessionAuthorityDenied {
  ok: false;
  code: SessionAuthorityFailureCode;
  status: 401 | 403;
}

/**
 * Validate a verified JWT payload against the database active session.
 */
export async function assertActiveSession(
  payload: JWTPayload,
  correlationId: string
): Promise<SessionAuthorityResult | SessionAuthorityDenied> {
  const record = await loadSessionUser(payload.user_id);
  if (!record) {
    return { ok: false, code: 'SESSION_REVOKED', status: 401 };
  }

  if (!isAccountAllowed(record)) {
    return { ok: false, code: 'ACCOUNT_INACTIVE', status: 403 };
  }

  if (!isActiveSession(payload.session_id, record.active_session_id)) {
    return { ok: false, code: 'SESSION_REVOKED', status: 401 };
  }

  const sessionId = payload.session_id as string;
  const role =
    record.role === 'superadmin' ? 'superadmin' : ('user' as const);

  return {
    ok: true,
    user: {
      user_id: record.id,
      username: record.username,
      email: record.email,
      role,
      session_id: sessionId,
    },
    record,
    sessionId,
    correlationId,
  };
}

/**
 * Conditionally release the active session lock only if it still matches.
 */
export async function releaseActiveSessionIfMatch(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const rows = await sql`
    UPDATE users
    SET active_session_id = NULL,
        active_session_created_at = NULL
    WHERE id = ${userId}
      AND active_session_id = ${sessionId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Atomically transfer session when the caller's oldSessionId is still active.
 * Returns the new session id, or null if the old session no longer matches.
 */
export async function transferActiveSession(
  userId: string,
  oldSessionId: string | null | undefined,
  newSessionId: string
): Promise<'transferred' | 'mismatch' | 'empty'> {
  if (!oldSessionId) {
    // No claimed old session — only allow when there is currently no lock
    const rows = await sql`
      UPDATE users
      SET active_session_id = ${newSessionId},
          active_session_created_at = NOW()
      WHERE id = ${userId}
        AND active_session_id IS NULL
      RETURNING id
    `;
    return rows.length > 0 ? 'transferred' : 'mismatch';
  }

  const rows = await sql`
    UPDATE users
    SET active_session_id = ${newSessionId},
        active_session_created_at = NOW()
    WHERE id = ${userId}
      AND active_session_id = ${oldSessionId}
    RETURNING id
  `;
  if (rows.length > 0) {
    return 'transferred';
  }

  // Distinguish "already empty" vs wrong id for clearer transfer UX
  const current = await loadSessionUser(userId);
  if (!current?.active_session_id) {
    return 'empty';
  }
  return 'mismatch';
}
