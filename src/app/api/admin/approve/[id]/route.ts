import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getRequest, updateRequest, getSetting, createNotification, getAllRequests } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestApproved, triggerPlaybackUpdate } from '@/lib/pusher';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await authService.requireAdminAuth(req);
    const { id } = await params;
    
    const body = await req.json();
    const { add_to_queue = true, add_to_playlist = true, play_next = false } = body;
    
    const request = await getRequest(id);

    if (!request || request.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Request not found or already processed' 
      }, { status: 404 });
    }

    let queueSuccess = false;
    let playlistSuccess = false;
    let errors: string[] = [];

    // Add to Spotify queue if requested
    if (add_to_queue) {
      try {
        const deviceSetting = await getSetting('target_device_id');
        await spotifyService.addToQueue(request.track_uri, deviceSetting || undefined);
        queueSuccess = true;
        
        // Note: Spotify API doesn't support adding to front of queue directly
        // The track will be added to the end of the queue and will play after current queue items
        // play_next parameter is kept for future enhancement or different queue management strategy
      } catch (error) {
        console.error('Error adding to queue:', error);
        errors.push('Failed to add to Spotify queue');
      }
    }

    // Add to playlist if requested
    if (add_to_playlist) {
      try {
        const playlistSetting = await getSetting('party_playlist_id');

        if (!playlistSetting) {
          errors.push('Party playlist not configured');
        } else {
          await spotifyService.addToPlaylist(playlistSetting, request.track_uri);
          playlistSuccess = true;
        }
      } catch (error) {
        console.error('Error adding to playlist:', error);
        errors.push('Failed to add to party playlist');
      }
    }

    const newStatus = (queueSuccess || playlistSuccess) ? 'approved' : 'failed';
    
    await updateRequest(id, {
      status: newStatus,
      approved_at: new Date().toISOString(),
      approved_by: admin.username,
      spotify_added_to_queue: queueSuccess,
      spotify_added_to_playlist: playlistSuccess
    });

    // Create approval notification for display
    if (newStatus === 'approved') {
      await createNotification({
        type: 'approval',
        message: `Request by ${request.requester_nickname || 'Anonymous'} for ${request.track_name} approved!`,
        requester_name: request.requester_nickname,
        track_name: request.track_name
      });

      // 🚀 PUSHER: Trigger real-time event for approved request
      try {
        await triggerRequestApproved({
          id: request.id,
          track_name: request.track_name,
          artist_name: request.artist_name,
          album_name: request.album_name || 'Unknown Album',
          track_uri: request.track_uri,
          requester_nickname: request.requester_nickname || 'Anonymous',
          approved_at: new Date().toISOString(),
          approved_by: admin.username
        });
        console.log(`🎉 Pusher event sent for approved request: ${request.track_name}`);
        
        // Also trigger a playback update to refresh the queue on display page
        try {
          console.log('🔄 Fetching updated queue after approval...');
          
          // Give Spotify a moment to update, then fetch fresh queue data
          setTimeout(async () => {
            try {
              const [currentPlayback, queue] = await Promise.all([
                spotifyService.getCurrentPlayback().catch(() => null),
                spotifyService.getQueue().catch(() => null)
              ]);

              if (queue?.queue) {
                // Get approved requests to match with queue items
                const approvedRequests = await getAllRequests().then(requests => 
                  requests.filter(r => r.status === 'approved')
                );

                // Enhance queue items with requester information
                const enhancedQueue = queue.queue.map((track: any) => {
                  const matchingRequest = approvedRequests.find(req => req.track_uri === track.uri);
                  return {
                    ...track,
                    requester_nickname: matchingRequest?.requester_nickname || null
                  };
                });

                // Trigger playback update with fresh queue data
                await triggerPlaybackUpdate({
                  current_track: currentPlayback?.item || null,
                  queue: enhancedQueue,
                  is_playing: currentPlayback?.is_playing || false,
                  progress_ms: currentPlayback?.progress_ms || 0,
                  timestamp: Date.now()
                });
                
                console.log('✅ Playback update sent with fresh queue data');
              }
            } catch (error) {
              console.error('Failed to send playback update after approval:', error);
            }
          }, 1500); // Wait 1.5 seconds for Spotify to update
          
        } catch (error) {
          console.error('Failed to setup playback update:', error);
        }
        
      } catch (pusherError) {
        console.error('❌ Failed to send Pusher event:', pusherError);
        // Don't fail the request if Pusher fails
      }
    }

    return NextResponse.json({
      success: true,
      message: play_next && queueSuccess ? 'Request approved and added to queue' : 'Request processed',
      result: {
        status: newStatus,
        queue_added: queueSuccess,
        playlist_added: playlistSuccess,
        play_next: play_next && queueSuccess,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error approving request:', error);
    return NextResponse.json({ 
      error: 'Failed to approve request' 
    }, { status: 500 });
  }
}