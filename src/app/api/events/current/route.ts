/**
 * GET /api/events/current
 * Get or create the current active event for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getActiveEvent, createEvent } from '@/lib/event-service';
import { isSecureAccessCode, isSixDigitAccessCode } from '@/lib/access-code';

function hasModernAccessCode(code: string): boolean {
  return isSixDigitAccessCode(code) || isSecureAccessCode(code);
}

export async function GET(req: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(req);
  if (!authResult.authenticated || !authResult.user) {
    return authResult.response;
  }

  const { user } = authResult;

  try {
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const controlEvent = await getDatabaseService().getEvent(user.user_id);
    const djEventOn =
      controlEvent?.status === 'live' || controlEvent?.status === 'standby';

    // Offline: never mint / return a guest code (Start Event owns createEvent).
    if (!djEventOn) {
      return NextResponse.json({ event: null }, { status: 200 });
    }

    // Try to get existing active event
    let event = await getActiveEvent(user.user_id);

    // Legacy 4-digit rows must not be resurrected — replace with a fresh 6/8-char code.
    if (event && !hasModernAccessCode(event.access_code || event.pin)) {
      console.log(
        `📅 Active event for ${user.username} still has legacy code; minting a new one`
      );
      event = await createEvent(user.user_id);
    }

    // Live/standby but no guest row (e.g. after purge) — mint one.
    if (!event) {
      console.log(`📅 No active event found for ${user.username}, creating new one`);
      event = await createEvent(user.user_id);
    }

    return NextResponse.json({ event }, { status: 200 });

  } catch (error) {
    console.error('❌ Failed to get/create event:', error);
    return NextResponse.json(
      { error: 'Failed to get event' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/current
 * Create a new event (deactivates existing one)
 */
export async function POST(req: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(req);
  if (!authResult.authenticated || !authResult.user) {
    return authResult.response;
  }

  const { user } = authResult;

  try {
    const { name } = await req.json();

    const event = await createEvent(user.user_id, name);

    return NextResponse.json(
      { event, message: 'Event created successfully' },
      { status: 201 }
    );

  } catch (error) {
    console.error('❌ Failed to create event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

