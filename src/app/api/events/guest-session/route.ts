/**
 * GET /api/events/guest-session
 * Returns event-scoped realtime identity for a valid guest cookie.
 * Does not disclose organiser UUID (PRD-04).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  GUEST_ACCESS_COOKIE,
  verifyGuestAccessToken,
} from '@/lib/guest-access';
import { verifyAccessCode } from '@/lib/event-service';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(GUEST_ACCESS_COOKIE)?.value;
    if (!cookie) {
      return NextResponse.json({ error: 'Guest session required' }, { status: 401 });
    }

    const payload = verifyGuestAccessToken(cookie);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid guest session' }, { status: 401 });
    }

    const event = await verifyAccessCode(payload.username, payload.accessCode);
    if (!event || (payload.eventId && payload.eventId !== event.id)) {
      return NextResponse.json(
        { error: 'Guest session expired or event ended' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: event.id,
      username: payload.username,
      // No userId — clients subscribe to private-event-{eventId}-guest
    });
  } catch (error) {
    console.error('[guest-session] error:', error);
    return NextResponse.json({ error: 'Failed to resolve guest session' }, { status: 500 });
  }
}
