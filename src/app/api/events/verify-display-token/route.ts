/**
 * POST /api/events/verify-display-token
 * Verify a display token for accessing the display page
 * Public endpoint (no authentication required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyDisplayToken } from '@/lib/event-service';

export async function POST(req: NextRequest) {
  try {
    const { username, displayToken } = await req.json();

    if (!username || !displayToken) {
      return NextResponse.json(
        { error: 'Username and display token are required' },
        { status: 400 }
      );
    }

    const result = await verifyDisplayToken(username, displayToken);

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid or expired display token' },
        { status: 401 }
      );
    }

    const { event, token } = result;

    return NextResponse.json(
      { 
        success: true, 
        event: {
          id: event.id,
          name: event.name,
          expires_at: event.expires_at
        },
        tokenUsesRemaining: token.uses_remaining
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Display token verification failed:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

