/**
 * Single-admin-session lock helpers.
 *
 * TTL is 24 hours (friendlier overnight re-login than the 7-day JWT).
 * Stale locks are cleared on login without showing the transfer modal.
 * Pusher presence is intentionally not used — it is optional/unreliable here;
 * we rely on TTL + same-session JWT resume + accurate copy instead.
 */

/** Admin session lock TTL: 24 hours (not the 7-day JWT lifetime). */
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface AdminSessionLock {
  activeSessionId: string | null;
  activeSessionCreatedAt: Date | string | null;
}

export interface SessionTransferInfo {
  sessionId: string;
  created_at: string;
  device_info?: string;
  /** True only when cookie JWT session_id exists and differs from the DB lock. */
  likelyDifferentClient: boolean;
}

export type AdminSessionLoginDecision =
  | { action: 'proceed_new' }
  | { action: 'clear_expired_then_proceed' }
  | { action: 'resume_same'; sessionId: string }
  | {
      action: 'require_transfer';
      sessionId: string;
      createdAt: string;
      likelyDifferentClient: boolean;
    };

export function isAdminSessionExpired(
  createdAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!createdAt) return true;
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const createdMs = created.getTime();
  if (Number.isNaN(createdMs)) return true;
  return nowMs - createdMs > ADMIN_SESSION_TTL_MS;
}

/**
 * Soft signal only: cookie has a different session_id than the DB lock.
 * Missing/legacy cookies (no session_id) are NOT treated as another device.
 */
export function isLikelyDifferentClient(
  cookieSessionId: string | null | undefined,
  activeSessionId: string
): boolean {
  return Boolean(cookieSessionId && cookieSessionId !== activeSessionId);
}

/** Body for POST /api/auth/transfer-session (login page + test clients). */
export function buildSessionTransferRequestBody(params: {
  username: string;
  password: string;
  oldSessionId?: string;
}): {
  username: string;
  password: string;
  oldSessionId?: string;
} {
  return {
    username: params.username,
    password: params.password,
    oldSessionId: params.oldSessionId,
  };
}

export function decideAdminSessionLogin(params: {
  role: string;
  lock: AdminSessionLock;
  cookieSessionId?: string | null;
  nowMs?: number;
}): AdminSessionLoginDecision {
  const { role, lock, cookieSessionId } = params;
  const nowMs = params.nowMs ?? Date.now();

  if (role === 'superadmin') {
    return { action: 'proceed_new' };
  }

  const sessionId = lock.activeSessionId;
  const createdAt = lock.activeSessionCreatedAt;

  if (!sessionId || !createdAt) {
    return { action: 'proceed_new' };
  }

  if (isAdminSessionExpired(createdAt, nowMs)) {
    return { action: 'clear_expired_then_proceed' };
  }

  if (cookieSessionId && cookieSessionId === sessionId) {
    return { action: 'resume_same', sessionId };
  }

  const createdAtIso =
    typeof createdAt === 'string' ? createdAt : createdAt.toISOString();

  return {
    action: 'require_transfer',
    sessionId,
    createdAt: createdAtIso,
    likelyDifferentClient: isLikelyDifferentClient(cookieSessionId, sessionId),
  };
}
