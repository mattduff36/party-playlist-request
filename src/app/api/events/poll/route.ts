/**
 * Polling API endpoint for Pusher fallback
 * 
 * This endpoint provides a polling mechanism when Pusher connections fail.
 * It returns events that occurred after a specified timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';
import { PusherEvent, generateEventId, generateEventVersion } from '@/lib/pusher/events';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const auth = requireAuth(request);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const since = searchParams.get('since');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const sinceTimestamp = since ? parseInt(since) : 0;

    // Get recent requests only (fallback mode focuses on request events)
    const pool = getPool();
    const recentReqRes = await pool.query(
      `SELECT id, song_name, artist_name, album_name, track_uri, requester_nickname, user_session_id, created_at 
       FROM requests 
       WHERE event_id = $1 AND created_at > to_timestamp($2/1000.0)
       ORDER BY created_at DESC
       LIMIT 50`,
      [eventId, sinceTimestamp]
    );

    // Convert to Pusher events
    const pusherEvents: PusherEvent[] = [];

    for (const requestRow of recentReqRes.rows) {
      pusherEvents.push({
        id: generateEventId(),
        action: 'request_submitted',
        timestamp: new Date(requestRow.created_at).getTime(),
        version: generateEventVersion(),
        eventId,
        data: {
          requestId: requestRow.id,
          trackName: requestRow.song_name,
          artistName: requestRow.artist_name,
          albumName: requestRow.album_name,
          trackUri: requestRow.track_uri,
          requesterNickname: requestRow.requester_nickname || '',
          userSessionId: requestRow.user_session_id || '',
          submittedAt: new Date(requestRow.created_at).toISOString()
        }
      });
    }

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
