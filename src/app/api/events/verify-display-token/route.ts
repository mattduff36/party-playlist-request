/**
 * POST /api/events/verify-display-token
 * Atomic display-token consume + display session cookie (PRD-04).
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyDisplayToken } from '@/lib/event-service';
import {
  DISPLAY_ACCESS_COOKIE,
  type DisplayAccessPayload,
} from '@/lib/event-access-policy';

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
    const secret = process.env.JWT_SECRET || '';
    if (!secret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const displayPayload: DisplayAccessPayload = {
      typ: 'display',
      eventId: event.id,
      userId: event.user_id,
      username,
    };
    const displayJwt = jwt.sign(displayPayload, secret, { expiresIn: '24h' });

    const response = NextResponse.json(
      {
        success: true,
        event: {
          id: event.id,
          name: event.name,
          expires_at: event.expires_at,
        },
        tokenUsesRemaining: token.uses_remaining,
      },
      { status: 200 }
    );

    response.cookies.set(DISPLAY_ACCESS_COOKIE, displayJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('❌ Display token verification failed:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
