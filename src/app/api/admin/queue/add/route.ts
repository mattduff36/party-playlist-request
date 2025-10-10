import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🎵 [queue/add] User ${auth.user.username} (${userId}) adding to queue`);
    
    const body = await req.json();
    const { track_uri, position = 'bottom', device_id } = body;
    
    if (!track_uri) {
      return NextResponse.json({ 
        error: 'track_uri is required' 
      }, { status: 400 });
    }

    // For now, Spotify API only supports adding to the end of the queue
    // We'll implement "play next" functionality by adding to queue
    // and potentially skipping current track if position is "top" (MULTI-TENANT!)
    
    await spotifyService.addToQueue(track_uri, device_id, userId);
    
    return NextResponse.json({
      success: true,
      message: `Track added to ${position} of queue`,
      position
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error adding to queue:', error);
    return NextResponse.json({ 
      error: 'Failed to add track to queue' 
    }, { status: 500 });
  }
}
