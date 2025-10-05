/**
 * GET /api/events/current
 * Get or create the current active event for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getActiveEvent, createEvent } from '@/lib/event-service';

export async function GET(req: NextRequest) {
  // Require authentication
  const authResult = requireAuth(req);
  if (!authResult.authenticated || !authResult.user) {
    return authResult.response;
  }

  const { user } = authResult;

  try {
    // Try to get existing active event
    let event = await getActiveEvent(user.user_id);

    // If no active event, create one
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
  const authResult = requireAuth(req);
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

