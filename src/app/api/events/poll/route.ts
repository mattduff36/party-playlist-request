/**
 * Polling API endpoint for Pusher fallback
 * 
 * This endpoint provides a polling mechanism when Pusher connections fail.
 * It returns events that occurred after a specified timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, requests, spotifyStatus } from '@/lib/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { PusherEvent, generateEventId, generateEventVersion } from '@/lib/pusher/events';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const since = searchParams.get('since');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const sinceTimestamp = since ? parseInt(since) : 0;

    // Get events from database
    const eventData = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    
    if (eventData.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventData[0];

    // Get recent requests
    const recentRequests = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.eventId, eventId),
          gt(requests.createdAt, new Date(sinceTimestamp))
        )
      )
      .orderBy(desc(requests.createdAt))
      .limit(50);

    // Get current Spotify status
    const spotifyData = await db
      .select()
      .from(spotifyStatus)
      .where(eq(spotifyStatus.eventId, eventId))
      .limit(1);

    // Convert to Pusher events
    const pusherEvents: PusherEvent[] = [];

    // Add request events
    for (const request of recentRequests) {
      pusherEvents.push({
        id: generateEventId(),
        action: 'request-submitted',
        timestamp: request.createdAt.getTime(),
        version: generateEventVersion(),
        eventId,
        payload: {
          id: request.id,
          songName: request.songName,
          artistName: request.artistName,
          spotifyId: request.spotifyId,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt
        }
      });
    }

    // Add Spotify status event if available
    if (spotifyData.length > 0) {
      const status = spotifyData[0];
      pusherEvents.push({
        id: generateEventId(),
        action: 'playback-update',
        timestamp: status.updatedAt.getTime(),
        version: generateEventVersion(),
        eventId,
        payload: {
          isPlaying: status.isPlaying,
          currentTrack: status.currentTrack,
          progress: status.progress,
          volume: status.volume,
          device: status.device,
          updatedAt: status.updatedAt
        }
      });
    }

    // Add event state update
    pusherEvents.push({
      id: generateEventId(),
      action: 'event-state-update',
      timestamp: event.updatedAt.getTime(),
      version: generateEventVersion(),
      eventId,
      payload: {
        id: event.id,
        name: event.name,
        status: event.status,
        isActive: event.isActive,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      }
    });

    // Sort events by timestamp
    pusherEvents.sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      success: true,
      events: pusherEvents,
      count: pusherEvents.length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Polling API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
