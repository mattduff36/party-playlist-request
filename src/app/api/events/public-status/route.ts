/**
 * Public Event Status API Endpoint
 *
 * Unauthenticated guests may fetch event status for display/request shells.
 * Never returns access codes or bypass tokens.
 *
 * `event.id` is returned for client state hydration only. Public Pusher
 * `event-{id}` dual-publish is retired — knowing the id does not grant a
 * subscribe path without guest/display channel auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log(`📊 [public-status] Fetching event status for username: ${username}`);

    const userResult = await sql`
      SELECT id FROM users WHERE username = ${username} LIMIT 1
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult[0].id;

    const eventResult = await sql`
      SELECT 
        e.id,
        e.status,
        e.version,
        e.config,
        e.active_admin_id,
        e.updated_at
      FROM events e
      WHERE e.user_id = ${userId}
      ORDER BY e.updated_at DESC
      LIMIT 1
    `;

    if (eventResult.length === 0) {
      return NextResponse.json({
        success: true,
        event: {
          id: null,
          status: 'offline',
          version: 0,
          activeAdminId: null,
          config: {
            pages_enabled: {
              requests: false,
              display: false,
            },
            event_title: 'Party DJ Requests',
            welcome_message: 'Welcome to the party!',
            secondary_message: 'Request your favorite songs',
            tertiary_message: 'Have fun!',
          },
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const event = eventResult[0];

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        status: event.status,
        version: event.version,
        activeAdminId: event.active_admin_id,
        config: event.config,
        updatedAt: event.updated_at,
      },
    });
  } catch (error) {
    console.error('❌ Error getting public event status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get event status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
