/**
 * Guest access session cookies + API gate for public guest routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { isValidAccessCodeFormat } from '@/lib/access-code';
import { getActiveEvent, verifyAccessCode, type UserEvent } from '@/lib/event-service';
import { requireAuth } from '@/middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || '';
export const GUEST_ACCESS_COOKIE = 'pp_guest_access';
const GUEST_COOKIE_MAX_AGE_SEC = 24 * 60 * 60;

export const RESERVED_USERNAME_SEGMENTS = new Set([
  'admin',
  'request',
  'display',
  'login',
  'auth',
  'api',
  'superadmin',
  'contact',
  'privacy',
  'terms',
]);

export interface GuestAccessPayload {
  typ: 'guest';
  username: string;
  accessCode: string;
  eventId: string;
}

export function createGuestAccessToken(
  username: string,
  accessCode: string,
  eventId: string
): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { typ: 'guest', username, accessCode, eventId } satisfies GuestAccessPayload,
    JWT_SECRET,
    { expiresIn: GUEST_COOKIE_MAX_AGE_SEC }
  );
}

export function verifyGuestAccessToken(token: string): GuestAccessPayload | null {
  if (!JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as GuestAccessPayload;
    if (decoded.typ !== 'guest' || !decoded.username || !decoded.accessCode) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function guestAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE_SEC,
  };
}

export function setGuestAccessCookie(
  response: NextResponse,
  username: string,
  accessCode: string,
  eventId: string
): void {
  const token = createGuestAccessToken(username, accessCode, eventId);
  response.cookies.set(GUEST_ACCESS_COOKIE, token, guestAccessCookieOptions());
}

export function clearGuestAccessCookie(response: NextResponse): void {
  response.cookies.set(GUEST_ACCESS_COOKIE, '', {
    ...guestAccessCookieOptions(),
    maxAge: 0,
  });
}

export function extractAccessCodeFromRequest(
  req: NextRequest,
  body?: Record<string, unknown> | null
): string | null {
  const header = req.headers.get('x-access-code');
  if (header && isValidAccessCodeFormat(header.trim())) {
    return header.trim();
  }

  const { searchParams } = new URL(req.url);
  const fromQuery = searchParams.get('accessCode') || searchParams.get('code');
  if (fromQuery && isValidAccessCodeFormat(fromQuery.trim())) {
    return fromQuery.trim();
  }

  if (body) {
    const fromBody =
      (typeof body.accessCode === 'string' && body.accessCode) ||
      (typeof body.access_code === 'string' && body.access_code) ||
      (typeof body.pin === 'string' && body.pin);
    if (fromBody && isValidAccessCodeFormat(String(fromBody).trim())) {
      return String(fromBody).trim();
    }
  }

  const cookie = req.cookies.get(GUEST_ACCESS_COOKIE)?.value;
  if (cookie) {
    const payload = verifyGuestAccessToken(cookie);
    if (payload) {
      return payload.accessCode;
    }
  }

  return null;
}

export function guestAccessCookieMatchesUsername(
  req: NextRequest,
  username: string
): GuestAccessPayload | null {
  const cookie = req.cookies.get(GUEST_ACCESS_COOKIE)?.value;
  if (!cookie) return null;
  const payload = verifyGuestAccessToken(cookie);
  if (!payload || payload.username.toLowerCase() !== username.toLowerCase()) {
    return null;
  }
  return payload;
}

export interface GuestAccessResult {
  ok: true;
  event: UserEvent;
  accessCode: string;
  via: 'access_code' | 'cookie' | 'owner';
}

export interface GuestAccessDenied {
  ok: false;
  response: NextResponse;
}

/**
 * Resolve guest access for a username-scoped public API.
 * Accepts access code (query/header/body), guest cookie, or event owner session.
 */
export async function requireGuestAccess(
  req: NextRequest,
  username: string,
  body?: Record<string, unknown> | null
): Promise<GuestAccessResult | GuestAccessDenied> {
  if (!username) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Username is required' }, { status: 400 }),
    };
  }

  try {
    const auth = await requireAuth(req);
    if (auth.authenticated && auth.user?.username === username) {
      const { getPool } = await import('@/lib/db');
      const pool = getPool();
      const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [
        username,
      ]);
      if (userResult.rows.length > 0) {
        const event = await getActiveEvent(userResult.rows[0].id);
        if (event) {
          return {
            ok: true,
            event,
            accessCode: event.access_code || event.pin,
            via: 'owner',
          };
        }
      }
    }
  } catch {
    // Not authenticated as owner
  }

  // Prefer explicit code from header/query/body over any existing cookie
  const explicitCode = (() => {
    const header = req.headers.get('x-access-code');
    if (header && isValidAccessCodeFormat(header.trim())) return header.trim();
    const { searchParams } = new URL(req.url);
    const fromQuery = searchParams.get('accessCode') || searchParams.get('code');
    if (fromQuery && isValidAccessCodeFormat(fromQuery.trim())) return fromQuery.trim();
    if (body) {
      const fromBody =
        (typeof body.accessCode === 'string' && body.accessCode) ||
        (typeof body.access_code === 'string' && body.access_code) ||
        (typeof body.pin === 'string' && body.pin);
      if (fromBody && isValidAccessCodeFormat(String(fromBody).trim())) {
        return String(fromBody).trim();
      }
    }
    return null;
  })();

  if (explicitCode) {
    const event = await verifyAccessCode(username, explicitCode);
    if (event) {
      return {
        ok: true,
        event,
        accessCode: explicitCode,
        via: 'access_code',
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid access code or no active event' },
        { status: 401 }
      ),
    };
  }

  const cookiePayload = guestAccessCookieMatchesUsername(req, username);
  if (cookiePayload) {
    const event = await verifyAccessCode(username, cookiePayload.accessCode);
    if (event) {
      return {
        ok: true,
        event,
        accessCode: cookiePayload.accessCode,
        via: 'cookie',
      };
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Access code required' }, { status: 401 }),
  };
}

export {
  guestRequestUrl,
  guestDisplayUrl,
  isValidAccessCodeFormat,
  isSixDigitAccessCode,
  isSecureAccessCode,
} from '@/lib/access-code';
