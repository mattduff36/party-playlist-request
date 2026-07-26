import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequest, updateRequest, getSetting, createNotification, getEventSettings } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestApproved } from '@/lib/pusher';
import { messageQueue } from '@/lib/message-queue';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';
import { tickUserPlayback } from '@/lib/spotify-sync';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and get user info
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    const { id } = await params;
    
    console.log(`✅ [admin/approve] User ${auth.user.username} (${userId}) approving request ${id}`);
    
    const body = await req.json();
    // Playlists are read-only: approvals only add to the Spotify play queue.
    // Legacy clients may still send add_to_playlist — it is ignored.
    const { add_to_queue = true, play_next = false } = body;
    
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
    const errors: string[] = [];

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

    const newStatus = queueSuccess ? 'approved' : 'failed';
    
    await updateRequest(id, {
      status: newStatus,
      approved_at: new Date().toISOString(),
      approved_by: auth.user.username,
      spotify_added_to_queue: queueSuccess,
      spotify_added_to_playlist: false,
    }, userId);

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

      // 🔄 IMMEDIATE QUEUE REFRESH: in-process tick (no secret header hop)
      try {
        console.log(`🔄 Triggering immediate queue refresh for user ${userId}`);
        await tickUserPlayback(userId, auth.user.username, {
          force: true,
          queueInterval: 0,
        });
        console.log(`✅ Immediate queue refresh completed for user ${userId}`);
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
          
          const messageText = `${requesterName}\n\nhas requested\n\n${trackName}\nby\n${artistName}\n\nAdded to the\nqueue!`;
          
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

    reportActivity(req, 'request.approve', `Approved request ${id}`, {
      user: auth.user,
      meta: { requestId: id, track: request.track_name, queueSuccess, playlistSuccess: false },
    });

    return NextResponse.json({
      success: true,
      message: play_next && queueSuccess ? 'Request approved and added to queue' : 'Request processed',
      result: {
        status: newStatus,
        queue_added: queueSuccess,
        playlist_added: false,
        play_next: play_next && queueSuccess,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error approving request:', error);
    reportApiError(req, error);
    return NextResponse.json({ 
      error: 'Failed to approve request' 
    }, { status: 500 });
  }
}
