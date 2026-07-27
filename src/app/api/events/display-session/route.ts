/**
 * GET /api/events/display-session
 * Returns event-scoped realtime identity for a valid display access cookie.
 * Used by display clients to subscribe to private-event-{id}-display.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DISPLAY_ACCESS_COOKIE,
  type DisplayAccessPayload,
} from '@/lib/event-access-policy';
import { getPool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(DISPLAY_ACCESS_COOKIE)?.value;
    if (!cookie) {
      return NextResponse.json(
        { error: 'Display session required' },
        { status: 401 }
      );
    }

    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || '';
    if (!secret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    let decoded: DisplayAccessPayload;
    try {
      decoded = jwt.verify(cookie, secret) as DisplayAccessPayload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid display session' },
        { status: 401 }
      );
    }

    if (decoded.typ !== 'display' || !decoded.eventId) {
      return NextResponse.json(
        { error: 'Invalid display session' },
        { status: 401 }
      );
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id FROM user_events
       WHERE id = $1 AND active = true AND expires_at > NOW()
       LIMIT 1`,
      [decoded.eventId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Display session expired or event ended' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: decoded.eventId,
      username: decoded.username,
      // No userId — clients subscribe to private-event-{eventId}-display
    });
  } catch (error) {
    console.error('[display-session] error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve display session' },
      { status: 500 }
    );
  }
}
