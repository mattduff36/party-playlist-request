import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequest, getSetting } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    const { id } = await params;
    
    console.log(`🔄 [admin/play-again] User ${auth.user.username} (${userId}) replaying request ${id}`);
    
    const body = await req.json();
    const { play_next = false } = body;
    
    // Verify ownership - user can only play their own requests again
    const request = await getRequest(id, userId);

    if (!request) {
      console.log(`❌ [admin/play-again] Request ${id} not found or not owned by user ${userId}`);
      return NextResponse.json({ 
        error: 'Request not found or access denied' 
      }, { status: 404 });
    }

    // Allow re-adding any song to queue, regardless of status
    let queueSuccess = false;
    const errors: string[] = [];

    // Add to Spotify queue (MULTI-TENANT!)
    try {
      const deviceSetting = await getSetting('target_device_id');
      await spotifyService.addToQueue(request.track_uri, deviceSetting || undefined, userId);
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
