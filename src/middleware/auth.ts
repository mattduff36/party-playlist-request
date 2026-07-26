/**
 * Authentication Middleware
 * Authoritative JWT + active-session validation (PRD-02)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractToken, type JWTPayload } from '@/lib/auth';
import {
  assertActiveSession,
} from '@/lib/auth/session-authority';
import { assertCsrfForCookieMutation } from '@/lib/auth/csrf';
import {
  emitSecurityAudit,
  newCorrelationId,
} from '@/lib/auth/security-audit';

export interface AuthContext {
  authenticated: boolean;
  user: JWTPayload | null;
  sessionId?: string;
  correlationId?: string;
  response?: NextResponse;
}

function genericUnauthorized(code: string): NextResponse {
  const message =
    code === 'SESSION_REVOKED'
      ? 'Session revoked'
      : code === 'ACCOUNT_INACTIVE'
        ? 'Forbidden'
        : 'Authentication required';
  const status = code === 'ACCOUNT_INACTIVE' ? 403 : 401;
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Require authentication — validates JWT and users.active_session_id.
 * Cookie mutations also enforce CSRF / same-origin.
 *
 * Token resolution is cookie-first (see extractToken). When an auth cookie is
 * present, CSRF applies regardless of any Authorization header.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const correlationId = req.headers.get('x-correlation-id') || newCorrelationId();

  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('auth_token')?.value;
  const token = extractToken(authHeader, cookieToken);

  if (!token) {
    return {
      authenticated: false,
      user: null,
      correlationId,
      response: genericUnauthorized('NO_TOKEN'),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      authenticated: false,
      user: null,
      correlationId,
      response: genericUnauthorized('INVALID_TOKEN'),
    };
  }

  const csrf = assertCsrfForCookieMutation(req);
  if (!csrf.ok) {
    return {
      authenticated: false,
      user: null,
      correlationId,
      response: csrf.response,
    };
  }

  let authority;
  try {
    authority = await assertActiveSession(payload, correlationId);
  } catch (error) {
    console.error('❌ Session authority lookup failed:', error);
    return {
      authenticated: false,
      user: null,
      correlationId,
      response: NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_UNAVAILABLE' },
        { status: 503 }
      ),
    };
  }

  if (!authority.ok) {
    if (authority.code === 'SESSION_REVOKED') {
      emitSecurityAudit('auth.session_revoked', {
        correlationId,
        userId: payload.user_id,
        meta: { path: req.nextUrl?.pathname || '' },
      });
    }
    return {
      authenticated: false,
      user: null,
      correlationId,
      response: genericUnauthorized(authority.code),
    };
  }

  return {
    authenticated: true,
    user: authority.user,
    sessionId: authority.sessionId,
    correlationId,
    response: undefined,
  };
}

/**
 * Require ownership - validates that username in URL matches JWT username
 * Returns 403 if user tries to access another user's resources
 * Super admin can access any resource
 */
export function requireOwnResource(
  req: NextRequest,
  user: JWTPayload,
  usernameInUrl: string
): {
  authorized: boolean;
  response?: NextResponse;
} {
  if (user.role === 'superadmin') {
    return { authorized: true };
  }

  if (user.username !== usernameInUrl) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Forbidden - You can only access your own resources',
          code: 'NOT_OWNER',
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Require super admin role (after authoritative auth).
 * Does not bypass active-session validation — call requireAuth first.
 */
export function requireSuperAdmin(user: JWTPayload): {
  authorized: boolean;
  response?: NextResponse;
} {
  if (user.role !== 'superadmin') {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Forbidden - Super admin access required',
          code: 'NOT_SUPERADMIN',
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Combined middleware: Require auth + ownership
 */
export async function requireAuthAndOwnership(
  req: NextRequest,
  usernameInUrl: string
): Promise<{
  authenticated: boolean;
  authorized: boolean;
  user: JWTPayload | null;
  response?: NextResponse;
}> {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated || !authResult.user) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      response: authResult.response,
    };
  }

  const ownershipResult = requireOwnResource(
    req,
    authResult.user,
    usernameInUrl
  );
  if (!ownershipResult.authorized) {
    return {
      authenticated: true,
      authorized: false,
      user: authResult.user,
      response: ownershipResult.response,
    };
  }

  return {
    authenticated: true,
    authorized: true,
    user: authResult.user,
    response: undefined,
  };
}

/**
 * Security: Validate username format
 * Only allow alphanumeric and hyphens
 */
export function sanitizeUsername(username: string): boolean {
  const validPattern = /^[a-z0-9-]{3,50}$/;
  return validPattern.test(username);
}
