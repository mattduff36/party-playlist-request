/**
 * Same-origin + double-submit CSRF protection for cookie-authenticated mutations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, timingSafeEqual } from 'crypto';
import { getAppBaseUrl } from '@/lib/app-url';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function getCsrfCookieOptions(isProduction: boolean) {
  return {
    httpOnly: false, // double-submit: JS must read and mirror into header
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };
}

export function setCsrfCookie(response: NextResponse, token?: string): string {
  const value = token || generateCsrfToken();
  const isProduction = process.env.NODE_ENV === 'production';
  response.cookies.set(CSRF_COOKIE_NAME, value, getCsrfCookieOptions(isProduction));
  return value;
}

function parseOrigin(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const base = getAppBaseUrl();
  try {
    origins.add(new URL(base).origin);
  } catch {
    // ignore
  }
  // Local / test defaults
  origins.add('http://localhost:3000');
  origins.add('http://127.0.0.1:3000');
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '');
    origins.add(`https://${host}`);
  }
  return origins;
}

/**
 * Validate Origin (preferred) or Referer against the application allowlist.
 */
export function isSameOriginRequest(req: NextRequest): boolean {
  const allowed = allowedOrigins();
  const origin = parseOrigin(req.headers.get('origin'));
  if (origin) {
    return allowed.has(origin.origin);
  }

  const referer = parseOrigin(req.headers.get('referer'));
  if (referer) {
    return allowed.has(referer.origin);
  }

  // Non-browser / same-site navigations without Origin: allow only when
  // Authorization Bearer is present (not cookie-only CSRF surface).
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return true;
  }

  // In test env, allow missing Origin for unit route tests.
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  return false;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface CsrfCheckResult {
  ok: boolean;
  response?: NextResponse;
}

/**
 * Enforce CSRF + same-origin for cookie-authenticated state-changing requests.
 * Bearer-only clients without cookies are exempt (not a CSRF vector).
 */
export function assertCsrfForCookieMutation(req: NextRequest): CsrfCheckResult {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return { ok: true };
  }

  const cookieToken = req.cookies.get('auth_token')?.value;
  if (!cookieToken) {
    // No cookie session → CSRF not applicable (Bearer or unauthenticated).
    return { ok: true };
  }

  if (!isSameOriginRequest(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'CSRF_ORIGIN' },
        { status: 403 }
      ),
    };
  }

  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  // Reject classic cross-site form posts; JSON / empty body mutations are expected.
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'CSRF_CONTENT_TYPE' },
        { status: 403 }
      ),
    };
  }

  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!headerToken || !csrfCookie || !safeEqual(headerToken, csrfCookie)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'CSRF_TOKEN' },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}
