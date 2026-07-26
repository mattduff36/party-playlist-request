/**
 * PRD-04 reusable event-access policy for guest/display/public/admin capabilities.
 */

import { NextRequest } from 'next/server';
import {
  guestAccessCookieMatchesUsername,
  extractAccessCodeFromRequest,
  verifyGuestAccessToken,
  GUEST_ACCESS_COOKIE,
  type GuestAccessPayload,
} from '@/lib/guest-access';
import {
  getActiveEvent,
  verifyAccessCode,
  type UserEvent,
} from '@/lib/event-service';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/middleware/auth';

export type EventCapability =
  | 'submit'
  | 'read_request_status'
  | 'display_read'
  | 'public_limited_status'
  | 'guest_realtime'
  | 'display_realtime';

export interface EventAccessContext {
  event: UserEvent;
  username: string;
  via: 'access_code' | 'cookie' | 'owner' | 'display_token';
  capability: EventCapability;
}

export interface EventAccessDenied {
  ok: false;
  reason: string;
  status: number;
}

export interface EventAccessGranted {
  ok: true;
  context: EventAccessContext;
}

function eventAllowsCapability(
  event: UserEvent,
  capability: EventCapability
): boolean {
  if (!event.active) return false;
  if (new Date(event.expires_at).getTime() <= Date.now()) return false;
  // submit / display page flags are enforced by callers via settings when needed
  void capability;
  return true;
}

export async function resolveUsernameUserId(
  username: string
): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id FROM users WHERE username = $1 LIMIT 1`,
    [username]
  );
  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

/**
 * Guest/owner access for a username-scoped capability.
 * Display-token path is separate (see resolveDisplayAccess).
 */
export async function resolveGuestEventAccess(
  req: NextRequest,
  username: string,
  capability: EventCapability,
  body?: Record<string, unknown> | null
): Promise<EventAccessGranted | EventAccessDenied> {
  if (!username) {
    return { ok: false, reason: 'Username is required', status: 400 };
  }

  try {
    const auth = await requireAuth(req);
    if (auth.authenticated && auth.user?.username === username) {
      const userId = await resolveUsernameUserId(username);
      if (userId) {
        const event = await getActiveEvent(userId);
        if (event && eventAllowsCapability(event, capability)) {
          return {
            ok: true,
            context: {
              event,
              username,
              via: 'owner',
              capability,
            },
          };
        }
      }
    }
  } catch {
    // not owner
  }

  const explicitCode = extractAccessCodeFromRequest(req, body);
  const cookiePayload = guestAccessCookieMatchesUsername(req, username);

  let event: UserEvent | null = null;
  let via: EventAccessContext['via'] = 'access_code';

  if (explicitCode) {
    event = await verifyAccessCode(username, explicitCode);
    via = 'access_code';
  } else if (cookiePayload) {
    event = await verifyAccessCode(username, cookiePayload.accessCode);
    via = 'cookie';
    if (event && cookiePayload.eventId && cookiePayload.eventId !== event.id) {
      return { ok: false, reason: 'Guest session event mismatch', status: 401 };
    }
  }

  if (!event || !eventAllowsCapability(event, capability)) {
    return {
      ok: false,
      reason: explicitCode
        ? 'Invalid access code or no active event'
        : 'Access code required',
      status: 401,
    };
  }

  return {
    ok: true,
    context: { event, username, via, capability },
  };
}

export function readGuestCookiePayload(
  req: NextRequest
): GuestAccessPayload | null {
  const cookie = req.cookies.get(GUEST_ACCESS_COOKIE)?.value;
  if (!cookie) return null;
  return verifyGuestAccessToken(cookie);
}

/**
 * Prove guest may subscribe to an event guest channel (by eventId).
 * Guest cookies must never authorise admin or display channels (caller enforces kind).
 */
export async function proveGuestForEvent(
  req: NextRequest,
  eventId: string
): Promise<UserEvent | null> {
  const payload = readGuestCookiePayload(req);
  if (!payload?.eventId || payload.eventId !== eventId) {
    return null;
  }
  const event = await verifyAccessCode(payload.username, payload.accessCode);
  if (!event || event.id !== eventId) return null;
  if (!eventAllowsCapability(event, 'guest_realtime')) return null;
  return event;
}

/**
 * Prove guest may subscribe to legacy private-party-playlist-{userId}.
 * Requires guest cookie for an active event owned by that userId.
 */
export async function proveGuestForUserChannel(
  req: NextRequest,
  userId: string
): Promise<UserEvent | null> {
  const payload = readGuestCookiePayload(req);
  if (!payload) return null;
  const event = await verifyAccessCode(payload.username, payload.accessCode);
  if (!event || event.user_id !== userId) return null;
  if (payload.eventId && payload.eventId !== event.id) return null;
  if (!eventAllowsCapability(event, 'guest_realtime')) return null;
  return event;
}

/**
 * Display realtime proof: guest cookie alone is NEVER enough.
 * Requires a display-purpose session cookie or verified display token header.
 */
export const DISPLAY_ACCESS_COOKIE = 'pp_display_access';

export interface DisplayAccessPayload {
  typ: 'display';
  eventId: string;
  userId: string;
  username: string;
}

export async function proveDisplayForEvent(
  req: NextRequest,
  eventId: string
): Promise<UserEvent | null> {
  // Prefer dedicated display cookie (set after atomic display-token consume)
  const cookie = req.cookies.get(DISPLAY_ACCESS_COOKIE)?.value;
  if (cookie) {
    try {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || '';
      if (!secret) return null;
      const decoded = jwt.verify(cookie, secret) as DisplayAccessPayload;
      if (
        decoded.typ !== 'display' ||
        decoded.eventId !== eventId
      ) {
        return null;
      }
      const pool = getPool();
      const result = await pool.query(
        `SELECT id, user_id, name, pin, access_code, bypass_token, active,
                started_at, ended_at, expires_at, created_at
         FROM user_events
         WHERE id = $1 AND active = true AND expires_at > NOW()
         LIMIT 1`,
        [eventId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      const code = String(row.access_code || row.pin || '');
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        name: (row.name as string | null) ?? null,
        pin: code,
        access_code: code,
        bypass_token: '',
        active: Boolean(row.active),
        started_at: row.started_at as Date,
        ended_at: (row.ended_at as Date | null) ?? null,
        expires_at: row.expires_at as Date,
        created_at: row.created_at as Date,
      };
    } catch {
      return null;
    }
  }
  return null;
}
