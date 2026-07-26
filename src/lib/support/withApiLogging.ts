/**
 * Lightweight helpers for API route instrumentation.
 */

import { NextRequest } from 'next/server';
import { hashIP } from '@/lib/db';
import { logActivityAsync, logErrorAsync } from '@/lib/support/logger';
import type { SupportActorRole } from '@/lib/support/types';
import type { JWTPayload } from '@/lib/auth';

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Hash client IP for rate limits / support logs.
 * In production, IP_SALT failures propagate (fail-closed) — do not collapse to 'unknown'
 * on rate-limit paths. Outside production, missing salt falls back to 'unknown'.
 */
export function getIpHash(
  req: NextRequest,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  try {
    return hashIP(getClientIp(req), nodeEnv);
  } catch (error) {
    if (nodeEnv === 'production') {
      throw error;
    }
    return 'unknown';
  }
}

export function actorRoleFromUser(user?: JWTPayload | null): SupportActorRole {
  if (!user) return 'guest';
  if (user.role === 'superadmin') return 'superadmin';
  return 'admin';
}

export function reportApiError(
  req: NextRequest,
  error: unknown,
  options?: {
    user?: JWTPayload | null;
    eventId?: string | null;
    source?: 'api' | 'spotify' | 'db' | 'pusher' | 'unknown';
    meta?: Record<string, unknown>;
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message || String(error);
  const isHandled =
    /\b429\b/.test(message) ||
    /rate limit/i.test(message) ||
    /rate limited/i.test(message) ||
    /\bbackoff\b/i.test(message) ||
    /No token provided/i.test(message) ||
    /Admin access required/i.test(message) ||
    /Unauthorized/i.test(message);

  logErrorAsync({
    level: 'error',
    source: options?.source || 'api',
    classification: isHandled ? 'handled' : 'unhandled',
    message,
    stack: err.stack,
    route: req.nextUrl?.pathname || req.url,
    method: req.method,
    userId: options?.user?.user_id,
    username: options?.user?.username,
    eventId: options?.eventId,
    ipHash: getIpHash(req),
    userAgent: req.headers.get('user-agent'),
    meta: {
      ...options?.meta,
      handled: isHandled,
      expected: isHandled,
    },
  });
}

export function reportActivity(
  req: NextRequest,
  action: string,
  summary: string,
  options?: {
    user?: JWTPayload | null;
    actorRole?: SupportActorRole;
    eventId?: string | null;
    userId?: string | null;
    username?: string | null;
    meta?: Record<string, unknown>;
  }
): void {
  logActivityAsync({
    action,
    actorRole: options?.actorRole || actorRoleFromUser(options?.user),
    summary,
    userId: options?.userId ?? options?.user?.user_id,
    username: options?.username ?? options?.user?.username,
    eventId: options?.eventId,
    route: req.nextUrl?.pathname || req.url,
    ipHash: getIpHash(req),
    meta: options?.meta,
  });
}
