/**
 * POST /api/events/display-token
 * Create a new display token for the current active event
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getActiveEvent, createDisplayToken } from '@/lib/event-service';

export async function POST(req: NextRequest) {
  // Require authentication
  const authResult = requireAuth(req);
  if (!authResult.authenticated || !authResult.user) {
    return authResult.response;
  }

  const { user } = authResult;

  try {
    // Get active event
    const event = await getActiveEvent(user.user_id);

    if (!event) {
      return NextResponse.json(
        { error: 'No active event found. Please start an event first.' },
        { status: 404 }
      );
    }

    // Get options from request body
    const { usesRemaining, hoursValid } = await req.json().catch(() => ({}));

    // Create display token
    const displayToken = await createDisplayToken(
      event.id,
      user.user_id,
      usesRemaining || 3,
      hoursValid || 24
    );

    return NextResponse.json(
      { 
        displayToken: {
          token: displayToken.token,
          uses_remaining: displayToken.uses_remaining,
          expires_at: displayToken.expires_at
        },
        displayUrl: `/${user.username}/display?dt=${displayToken.token}`
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('❌ Failed to create display token:', error);
    return NextResponse.json(
      { error: 'Failed to create display token' },
      { status: 500 }
    );
  }
}

