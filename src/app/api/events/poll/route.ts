/**
 * Polling API endpoint for Pusher fallback (PRD-05).
 *
 * Uses the live multi-tenant pg schema (flat `requests`, `spotify_auth`)
 * via getPool — not the quarantined Drizzle JSONB / spotify_tokens model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';
import type { EventConfig } from '@/lib/db/types';
import {
  type PusherEvent,
  generateEventId,
  generateEventVersion,
} from '@/lib/pusher/events';

interface EventRow {
  id: string;
  user_id: string;
  status: string;
  config: EventConfig | null;
  active_admin_id: string | null;
  updated_at: Date;
}

interface RequestRow {
  id: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  requester_nickname: string | null;
  user_session_id: string | null;
  created_at: Date;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const since = searchParams.get('since');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    const sinceDate = new Date(sinceTimestamp);
    const pool = getPool();
    const userId = auth.user.user_id;

    const eventResult = await pool.query<EventRow>(
      `SELECT id, user_id, status, config, active_admin_id, updated_at
       FROM events
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [eventId, userId]
    );

    if (eventResult.rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventResult.rows[0];

    const requestsResult = await pool.query<RequestRow>(
      `SELECT id, track_uri, track_name, artist_name, album_name,
              requester_nickname, user_session_id, created_at, status
       FROM requests
       WHERE user_id = $1
         AND created_at > $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, sinceDate]
    );

    const pusherEvents: PusherEvent[] = [];

    for (const songRequest of requestsResult.rows) {
      pusherEvents.push({
        id: generateEventId(),
        action: 'request_submitted',
        timestamp: songRequest.created_at.getTime(),
        version: generateEventVersion(),
        eventId,
        data: {
          requestId: songRequest.id,
          trackName: songRequest.track_name ?? 'Unknown',
          artistName: songRequest.artist_name ?? 'Unknown',
          albumName: songRequest.album_name ?? '',
          trackUri: songRequest.track_uri,
          requesterNickname: songRequest.requester_nickname ?? 'Guest',
          userSessionId: songRequest.user_session_id ?? '',
          submittedAt: songRequest.created_at.toISOString(),
        },
      });
    }

    const spotifyResult = await pool.query<{
      expires_at: Date | null;
      updated_at: Date | null;
    }>(
      `SELECT expires_at, updated_at
       FROM spotify_auth
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (spotifyResult.rows.length > 0) {
      const token = spotifyResult.rows[0];
      const expiresAt = token.expires_at?.getTime() ?? 0;
      if (expiresAt > 0 && expiresAt <= Date.now()) {
        pusherEvents.push({
          id: generateEventId(),
          action: 'token_expired',
          timestamp: token.updated_at?.getTime() ?? Date.now(),
          version: generateEventVersion(),
          eventId,
          data: {
            reason: 'expired',
            message: 'Spotify access token has expired',
            affectedService: 'spotify',
          },
        });
      }
    }

    const config = (event.config ?? {}) as EventConfig;
    pusherEvents.push({
      id: generateEventId(),
      action: 'state_update',
      timestamp: event.updated_at.getTime(),
      version: generateEventVersion(),
      eventId,
      data: {
        status: event.status as 'offline' | 'standby' | 'live',
        pagesEnabled: {
          requests: config.pages_enabled?.requests ?? false,
          display: config.pages_enabled?.display ?? false,
        },
        config: {
          event_title: config.event_title,
          welcome_message: config.welcome_message,
          secondary_message: config.secondary_message,
          tertiary_message: config.tertiary_message,
        },
        adminId: event.active_admin_id ?? undefined,
      },
    });

    pusherEvents.sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      success: true,
      events: pusherEvents,
      count: pusherEvents.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Polling API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
