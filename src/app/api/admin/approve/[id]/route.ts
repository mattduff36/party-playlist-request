import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequest, updateRequest, getSetting, createNotification, getEventSettings } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestApproved } from '@/lib/pusher';
import { messageQueue } from '@/lib/message-queue';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    const { id } = await params;
    
    console.log(`✅ [admin/approve] User ${auth.user.username} (${userId}) approving request ${id}`);
    
    const body = await req.json();
    const { add_to_queue = true, add_to_playlist = true, play_next = false } = body;
    
    // Verify ownership - user can only approve their own requests
    const request = await getRequest(id, userId);
    
    if (!request) {
      console.log(`❌ [admin/approve] Request ${id} not found or not owned by user ${userId}`);
      return NextResponse.json({ 
        error: 'Request not found or access denied' 
      }, { status: 404 });
    }

    if (request.status !== 'pending' && request.status !== 'rejected') {
      return NextResponse.json({ 
        error: 'Request already processed' 
      }, { status: 400 });
    }

    let queueSuccess = false;
    let playlistSuccess = false;
    let errors: string[] = [];

    // Add to Spotify queue if requested (MULTI-TENANT!)
    if (add_to_queue) {
      try {
        const deviceSetting = await getSetting('target_device_id');
        await spotifyService.addToQueue(request.track_uri, deviceSetting || undefined, userId);
        queueSuccess = true;
        
        // Note: Spotify API doesn't support adding to front of queue directly
        // The track will be added to the end of the queue and will play after current queue items
        // play_next parameter is kept for future enhancement or different queue management strategy
      } catch (error) {
        console.error('Error adding to queue:', error);
        errors.push('Failed to add to Spotify queue');
      }
    }

    // Add to playlist if requested (MULTI-TENANT!)
    if (add_to_playlist) {
      try {
        const playlistSetting = await getSetting('party_playlist_id');

        if (!playlistSetting) {
          errors.push('Party playlist not configured');
        } else {
          await spotifyService.addToPlaylist(playlistSetting, request.track_uri, userId);
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
      approved_by: auth.user.username,
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

      // 🚀 PUSHER: Trigger real-time event for approved request (USER-SPECIFIC CHANNEL)
      try {
        await triggerRequestApproved({
          id: request.id,
          track_name: request.track_name,
          artist_name: request.artist_name,
          album_name: request.album_name || 'Unknown Album',
          track_uri: request.track_uri,
          requester_nickname: request.requester_nickname || 'Anonymous',
          user_session_id: request.user_session_id || undefined,
          play_next: play_next,
          approved_at: new Date().toISOString(),
          approved_by: auth.user.username,
          userId: userId // ✅ USER-SPECIFIC CHANNEL
        });
        console.log(`🎉 Pusher event sent for approved request: ${request.track_name}`);
        
      } catch (pusherError) {
        console.error('❌ Failed to send Pusher event:', pusherError);
        // Don't fail the request if Pusher fails
      }

      // 🔄 IMMEDIATE QUEUE REFRESH: Trigger immediate queue check to update Up Next list
      try {
        console.log(`🔄 Triggering immediate queue refresh for user ${userId}`);
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/spotify-watcher`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SYSTEM_STARTUP_TOKEN || 'startup-system-token'}`
          },
          body: JSON.stringify({
            action: 'refresh-queue',
            userId: userId
          })
        });
        
        if (refreshResponse.ok) {
          console.log(`✅ Immediate queue refresh triggered for user ${userId}`);
        } else {
          console.log(`⚠️ Queue refresh failed for user ${userId}, will update via normal polling`);
        }
      } catch (refreshError) {
        console.error('❌ Failed to trigger immediate queue refresh:', refreshError);
        // Don't fail the request if queue refresh fails - normal polling will handle it
      }

      // 📢 AUTO-MESSAGE: Queue Notice Board message if enabled
      try {
        const eventSettings = await getEventSettings(userId);
        
        if (eventSettings.show_approval_messages) {
          const requesterName = request.requester_nickname || 'Anonymous';
          const artistName = request.artist_name || 'Unknown Artist';
          const trackName = request.track_name;
          
          const messageText = `${requesterName}\n\nhas requested\n\n${trackName}\nby\n${artistName}\n\nAdded to the\nParty Playlist!`;
          
          console.log(`📢 [admin/approve] Queueing auto-approval message: "${messageText.substring(0, 50)}..."`);
          
          // Add message to queue (10 seconds duration as documented)
          await messageQueue.addMessage(userId, messageText, 10);
          
          console.log(`✅ [admin/approve] Auto-approval message queued successfully`);
        }
      } catch (messageError) {
        console.error('❌ Failed to queue auto-approval message:', messageError);
        // Don't fail the approval if message fails
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