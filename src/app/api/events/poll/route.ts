/**
 * Polling API endpoint for Pusher fallback
 *
 * Returns events that occurred after a specified timestamp when Pusher
 * connections fail. Uses the drizzle client from `@/lib/db/index`
 * (not `@/lib/db`, which resolves to the legacy pg helper module).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { db } from '@/lib/db/index';
import {
  events,
  requests,
  spotify_tokens,
  type EventConfig,
  type TrackData,
} from '@/lib/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import {
  type PusherEvent,
  generateEventId,
  generateEventVersion,
} from '@/lib/pusher/events';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
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

    const eventData = await db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (eventData.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventData[0];

    const recentRequests = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.event_id, eventId),
          gt(requests.created_at, new Date(sinceTimestamp))
        )
      )
      .orderBy(desc(requests.created_at))
      .limit(50);

    const pusherEvents: PusherEvent[] = [];

    for (const songRequest of recentRequests) {
      const track = songRequest.track_data as TrackData;
      pusherEvents.push({
        id: generateEventId(),
        action: 'request_submitted',
        timestamp: songRequest.created_at.getTime(),
        version: generateEventVersion(),
        eventId,
        data: {
          requestId: songRequest.id,
          trackName: track?.name ?? 'Unknown',
          artistName: track?.artists?.[0]?.name ?? 'Unknown',
          albumName: track?.album?.name ?? '',
          trackUri: track?.uri ?? `spotify:track:${songRequest.track_id}`,
          requesterNickname: songRequest.submitted_by ?? 'Guest',
          userSessionId: '',
          submittedAt: songRequest.created_at.toISOString(),
        },
      });
    }

    if (event.active_admin_id) {
      const spotifyData = await db
        .select()
        .from(spotify_tokens)
        .where(eq(spotify_tokens.admin_id, event.active_admin_id))
        .limit(1);

      if (spotifyData.length > 0) {
        const token = spotifyData[0];
        const expiresAt = token.expires_at?.getTime() ?? 0;
        if (expiresAt > 0 && expiresAt <= Date.now()) {
          pusherEvents.push({
            id: generateEventId(),
            action: 'token_expired',
            timestamp: token.updated_at.getTime(),
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
