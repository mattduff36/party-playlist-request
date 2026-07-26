/**
 * POST /api/events/verify-pin
 * Verify an access code (or legacy bypass token) for a user's event.
 * Sets an httpOnly guest session cookie on success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessCode, verifyBypassToken } from '@/lib/event-service';
import {
  isValidAccessCodeFormat,
  setGuestAccessCookie,
} from '@/lib/guest-access';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';
import { getClientIp } from '@/lib/rate-limit';
import { hashIP } from '@/lib/db';
import {
  enforceGuestRateLimit,
  ensureGuestDeviceCookie,
  resolveGuestDeviceId,
} from '@/lib/reliability';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, pin, accessCode, bypassToken } = body;
    const code = (accessCode || pin || '').toString().trim();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const { deviceId } = resolveGuestDeviceId(req);
    const rate = await enforceGuestRateLimit({
      bucket: 'accessCodeVerify',
      primaryKey: `${username}:${deviceId}`,
      secondaryKey: hashIP(getClientIp(req)),
      secondaryMaxMultiplier: 3,
    });
    if (!rate.allowed) {
      const response = NextResponse.json(
        { error: rate.message || 'Too many attempts', code: 'RATE_LIMITED' },
        { status: 429 }
      );
      if (rate.retryAfter) {
        response.headers.set('Retry-After', String(rate.retryAfter));
      }
      ensureGuestDeviceCookie(response, deviceId);
      return response;
    }

    // Legacy bypass token (QR ?bt=)
    if (bypassToken) {
      const event = await verifyBypassToken(username, bypassToken);

      if (!event) {
        reportActivity(req, 'auth.pin_failed', `Invalid bypass for ${username}`, {
          actorRole: 'guest',
          username,
          meta: { method: 'bypass_token' },
        });
        return NextResponse.json(
          { error: 'Invalid or expired bypass token' },
          { status: 401 }
        );
      }

      reportActivity(req, 'auth.pin_ok', `Bypass access for ${username}`, {
        actorRole: 'guest',
        username,
        eventId: event.id,
        meta: { method: 'bypass_token' },
      });

      const response = NextResponse.json(
        {
          success: true,
          event: {
            id: event.id,
            name: event.name,
            expires_at: event.expires_at,
            accessCode: event.access_code,
          },
          authMethod: 'bypass_token',
        },
        { status: 200 }
      );
      setGuestAccessCookie(response, username, event.access_code, event.id);
      ensureGuestDeviceCookie(response, deviceId);
      return response;
    }

    if (!code) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    if (!isValidAccessCodeFormat(code)) {
      return NextResponse.json(
        { error: 'Invalid access code format' },
        { status: 400 }
      );
    }

    const event = await verifyAccessCode(username, code);

    if (!event) {
      reportActivity(req, 'auth.pin_failed', `Invalid access code for ${username}`, {
        actorRole: 'guest',
        username,
        meta: { method: 'access_code' },
      });
      return NextResponse.json(
        { error: 'Invalid access code or no active event' },
        { status: 401 }
      );
    }

    reportActivity(req, 'auth.pin_ok', `Access code verified for ${username}`, {
      actorRole: 'guest',
      username,
      eventId: event.id,
      meta: { method: 'access_code' },
    });

    const response = NextResponse.json(
      {
        success: true,
        event: {
          id: event.id,
          name: event.name,
          expires_at: event.expires_at,
          accessCode: event.access_code,
        },
        authMethod: 'access_code',
      },
      { status: 200 }
    );
    setGuestAccessCookie(response, username, event.access_code, event.id);
    ensureGuestDeviceCookie(response, deviceId);
    return response;
  } catch (error) {
    console.error('❌ Access code verification failed:', error);
    reportApiError(req, error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
