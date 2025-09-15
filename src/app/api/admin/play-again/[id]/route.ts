import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getRequest, getSetting } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await authService.requireAdminAuth(req);
    const { id } = await params;
    
    const body = await req.json();
    const { play_next = false } = body;
    
    const request = await getRequest(id);

    if (!request) {
      return NextResponse.json({ 
        error: 'Request not found' 
      }, { status: 404 });
    }

    // Allow re-adding any song to queue, regardless of status
    let queueSuccess = false;
    let errors: string[] = [];

    // Add to Spotify queue
    try {
      const deviceSetting = await getSetting('target_device_id');
      await spotifyService.addToQueue(request.track_uri, deviceSetting || undefined);
      queueSuccess = true;
      
      console.log(`🎵 Re-added "${request.track_name}" to Spotify queue (play_next: ${play_next})`);
    } catch (error) {
      console.error('Error adding to queue:', error);
      errors.push('Failed to add to Spotify queue');
    }

    const message = queueSuccess 
      ? `"${request.track_name}" added back to queue successfully`
      : 'Failed to add song to queue';

    return NextResponse.json({
      success: queueSuccess,
      message,
      result: {
        queue_added: queueSuccess,
        play_next,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error re-adding song to queue:', error);
    return NextResponse.json({ 
      error: 'Failed to add song to queue' 
    }, { status: 500 });
  }
}
