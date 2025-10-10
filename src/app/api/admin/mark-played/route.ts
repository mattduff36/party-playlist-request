import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { getRequestsByStatus, updateRequest } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`✅ [mark-played] User ${auth.user.username} (${userId}) marking played requests`);
    
    // Get current playback state (MULTI-TENANT!)
    const playbackState = await spotifyService.getCurrentPlayback(userId);
    
    if (!playbackState || !playbackState.item) {
      return NextResponse.json({
        success: true,
        message: 'No active playback',
        marked_played: 0
      });
    }
    
    const currentTrack = playbackState.item;
    let markedCount = 0;
    
    // Get user's approved requests only
    const approvedRequests = await getRequestsByStatus('approved', 100, 0, userId);
    
    // Check if current track matches any approved request
    for (const request of approvedRequests) {
      const isMatch = 
        request.track_uri === currentTrack.uri ||
        (request.track_name.toLowerCase() === currentTrack.name.toLowerCase() &&
         request.artist_name.toLowerCase() === currentTrack.artists.map((a: any) => a.name).join(', ').toLowerCase());
      
      if (isMatch) {
        // Mark as played
        await updateRequest(request.id, {
          status: 'played',
          approved_at: new Date().toISOString()
        });
        markedCount++;
        console.log(`✅ Marked request ${request.id} as played: ${request.track_name} by ${request.artist_name}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Checked ${approvedRequests.length} approved requests`,
      marked_played: markedCount,
      current_track: {
        name: currentTrack.name,
        artists: currentTrack.artists.map((a: any) => a.name),
        uri: currentTrack.uri
      }
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error marking played requests:', error);
    return NextResponse.json({ 
      error: 'Failed to mark played requests' 
    }, { status: 500 });
  }
}
