/**
 * POST /api/events/verify-pin
 * Verify a PIN for a user's event
 * Public endpoint (no authentication required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPIN, verifyBypassToken } from '@/lib/event-service';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';

export async function POST(req: NextRequest) {
  try {
    const { username, pin, bypassToken } = await req.json();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Check if using bypass token
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

      // Return success with event details
      return NextResponse.json(
        { 
          success: true, 
          event: {
            id: event.id,
            name: event.name,
            expires_at: event.expires_at
          },
          authMethod: 'bypass_token'
        },
        { status: 200 }
      );
    }

    // Check PIN
    if (!pin) {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4 digits' },
        { status: 400 }
      );
    }

    const event = await verifyPIN(username, pin);

    if (!event) {
      reportActivity(req, 'auth.pin_failed', `Invalid PIN for ${username}`, {
        actorRole: 'guest',
        username,
        meta: { method: 'pin' },
      });
      return NextResponse.json(
        { error: 'Invalid PIN or no active event' },
        { status: 401 }
      );
    }

    reportActivity(req, 'auth.pin_ok', `PIN verified for ${username}`, {
      actorRole: 'guest',
      username,
      eventId: event.id,
      meta: { method: 'pin' },
    });

    // Return success with event details
    return NextResponse.json(
      { 
        success: true, 
        event: {
          id: event.id,
          name: event.name,
          expires_at: event.expires_at
        },
        authMethod: 'pin'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ PIN verification failed:', error);
    reportApiError(req, error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

