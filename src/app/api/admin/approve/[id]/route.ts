import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { updateRequest, getSetting, createNotification, getEventSettings } from '@/lib/db';
import { triggerRequestApproved } from '@/lib/pusher';
import { messageQueue } from '@/lib/message-queue';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';
import { refreshPlaybackState } from '@/lib/reliability/refresh-playback';
import {
  claimRequestForApproval,
  getRequestCurrentStatus,
  releaseApprovalClaim,
  createProviderOperation,
  completeProviderOperation,
  classifySpotifyQueueError,
  shouldAttemptSpotifyQueueAdd,
} from '@/lib/reliability';
import {
  assignNextQueuePosition,
  resolvePlaybackProvider,
} from '@/lib/playback';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let claimedId: string | null = null;
  let claimUserId: string | null = null;

  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    const { id } = await params;
    
    console.log(`✅ [admin/approve] User ${auth.user.username} (${userId}) approving request ${id}`);
    
    const body = await req.json();
    const { add_to_queue = true, play_next = false } = body;

    // Atomic claim — concurrent approvals cannot both call Spotify
    const request = await claimRequestForApproval(id, userId);
    if (!request) {
      const current = await getRequestCurrentStatus(id, userId);
      if (!current) {
        return NextResponse.json(
          { error: 'Request not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: 'Request already processed',
          code: 'ALREADY_PROCESSED',
          result: { status: current },
        },
        { status: 409 }
      );
    }
    claimedId = id;
    claimUserId = userId;

    const { mode, provider } = await resolvePlaybackProvider(userId);
    const capabilities = provider.getCapabilities();

    let queueSuccess = false;
    const errors: string[] = [];
    let providerOperationId: string | null = null;
    let errorCategory: string | null = null;

    // Manual / providers without queueAdd: approve into app-owned queue only
    if (!capabilities.queueAdd || !add_to_queue) {
      queueSuccess = true;
    } else {
      const opKey = `approve-queue:${id}`;
      const op = await createProviderOperation({
        userId,
        eventId: request.event_id ?? null,
        requestId: id,
        operation: `${provider.id}.add_to_queue`,
        idempotencyKey: opKey,
      });
      providerOperationId = op.id;

      if (op.status === 'succeeded') {
        queueSuccess = true;
      } else if (op.status === 'uncertain') {
        // PRD-06: response was lost — never enqueue a second copy; reconcile only.
        queueSuccess = false;
        errorCategory = op.error_category ?? 'uncertain_timeout';
        errors.push(
          'Prior Spotify queue result is uncertain; reconcile before retrying'
        );
      } else if (shouldAttemptSpotifyQueueAdd(op.status)) {
        try {
          const deviceSetting = await getSetting('target_device_id');
          if (!provider.addToQueue) {
            throw new Error('Provider queue add unavailable');
          }
          const result = await provider.addToQueue(
            {
              providerId: provider.id,
              providerTrackId: request.provider_track_id ?? null,
              uri: request.track_uri,
              title: request.track_name,
              artists: request.artist_name,
              album: request.album_name,
              artworkUrl: request.album_image_url,
              durationMs: request.duration_ms,
            },
            {
              userId,
              eventId: request.event_id,
              deviceId: deviceSetting || undefined,
            }
          );
          if (!result.ok) {
            throw Object.assign(new Error(result.message || 'Queue add failed'), {
              category: result.category,
            });
          }
          queueSuccess = true;
          await completeProviderOperation(op.id, 'succeeded');
        } catch (error) {
          console.error('Error adding to queue:', error);
          errorCategory = classifySpotifyQueueError(error);
          const uncertain = errorCategory === 'uncertain_timeout';
          await completeProviderOperation(
            op.id,
            uncertain ? 'uncertain' : 'failed',
            errorCategory
          );
          errors.push(
            mode === 'spotify'
              ? 'Failed to add to Spotify queue'
              : 'Failed to add to provider queue'
          );
          queueSuccess = false;
        }
      } else {
        errors.push('Prior provider operation failed');
        errorCategory = op.error_category;
      }
    }

    const newStatus = queueSuccess ? 'approved' : 'queue_failed';
    
    await updateRequest(id, {
      status: newStatus,
      approved_at: new Date().toISOString(),
      approved_by: auth.user.username,
      spotify_added_to_queue:
        queueSuccess && add_to_queue && capabilities.queueAdd,
      spotify_added_to_playlist: false,
      queue_error_category: errorCategory,
      provider_operation_id: providerOperationId,
      claim_started_at: null,
    }, userId);
    claimedId = null;

    if (newStatus === 'approved') {
      try {
        await assignNextQueuePosition(userId, id);
      } catch (queuePosError) {
        console.error('❌ Failed to assign app queue position:', queuePosError);
      }

      await createNotification({
        type: 'approval',
        message: `Request by ${request.requester_nickname || 'Anonymous'} for ${request.track_name} approved!`,
        requester_name: request.requester_nickname,
        track_name: request.track_name
      });

      try {
        await triggerRequestApproved({
          id: request.id,
          track_name: request.track_name,
          artist_name: request.artist_name,
          album_name: request.album_name || 'Unknown Album',
          track_uri: request.track_uri || undefined,
          requester_nickname: request.requester_nickname || 'Anonymous',
          user_session_id: request.user_session_id || undefined,
          play_next: play_next,
          approved_at: new Date().toISOString(),
          approved_by: auth.user.username,
          userId: userId
        });
      } catch (pusherError) {
        console.error('❌ Failed to send Pusher event:', pusherError);
      }

      if (capabilities.nowPlaying && mode === 'spotify') {
        try {
          await refreshPlaybackState(userId, auth.user.username, 'approve', {
            force: true,
          });
        } catch (refreshError) {
          console.error('❌ Failed to trigger immediate queue refresh:', refreshError);
        }
      }

      try {
        const eventSettings = await getEventSettings(userId);
        
        if (eventSettings.show_approval_messages) {
          const requesterName = request.requester_nickname || 'Anonymous';
          const artistName = request.artist_name || 'Unknown Artist';
          const trackName = request.track_name;
          
          const messageText = `${requesterName}\n\nhas requested\n\n${trackName}\nby\n${artistName}\n\nAdded to the\nqueue!`;
          await messageQueue.addMessage(userId, messageText, 10);
        }
      } catch (messageError) {
        console.error('❌ Failed to queue auto-approval message:', messageError);
      }
    }

    reportActivity(req, 'request.approve', `Approved request ${id}`, {
      user: auth.user,
      meta: {
        requestId: id,
        track: request.track_name,
        queueSuccess,
        playlistSuccess: false,
        playbackMode: mode,
      },
    });

    return NextResponse.json({
      success: newStatus === 'approved',
      message:
        newStatus === 'approved'
          ? play_next && queueSuccess
            ? 'Request approved and added to queue'
            : 'Request processed'
          : 'Request claimed but provider queue failed',
      result: {
        status: newStatus,
        queue_added: queueSuccess && add_to_queue && capabilities.queueAdd,
        playlist_added: false,
        play_next: play_next && queueSuccess,
        errors: errors.length > 0 ? errors : null,
        error_category: errorCategory,
        playback_mode: mode,
        // Spotify cannot guarantee queue idempotency beyond this ledger.
        spotify_queue_idempotency: 'best_effort_ledger',
      }
    });

  } catch (error) {
    if (claimedId && claimUserId) {
      try {
        await releaseApprovalClaim(claimedId, claimUserId, 'queue_failed');
      } catch (releaseError) {
        console.error('Failed to release approval claim:', releaseError);
      }
    }

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
