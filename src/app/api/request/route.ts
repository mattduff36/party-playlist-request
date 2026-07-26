import { NextRequest, NextResponse } from 'next/server';
import { hashIP, getEventSettings, updateRequest } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestSubmitted, triggerRequestApproved } from '@/lib/pusher';
import { messageQueue } from '@/lib/message-queue';
import { validateRequesterName } from '@/lib/profanity-filter';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';
import { getClientIp } from '@/lib/rate-limit';
import { requireGuestAccess } from '@/lib/guest-access';
import { getTrackAlbumImageUrl } from '@/lib/spotify-album-art';
import {
  createIdempotentRequest,
  ensureGuestDeviceCookie,
  enforceGuestRateLimit,
  isValidIdempotencyKey,
  resolveGuestDeviceId,
} from '@/lib/reliability';

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🎵 [${requestId}] Request endpoint called`);
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const {
      track_uri,
      track_url,
      requester_nickname,
      user_session_id,
      username,
      idempotency_key: rawIdempotencyKey,
    } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const access = await requireGuestAccess(req, username, body);
    if (!access.ok) {
      return access.response;
    }

    if (!isValidIdempotencyKey(rawIdempotencyKey)) {
      return NextResponse.json(
        {
          error: 'idempotency_key (UUID) is required',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        },
        { status: 400 }
      );
    }
    const idempotencyKey = rawIdempotencyKey as string;
    
    if (!track_uri && !track_url) {
      return NextResponse.json({ 
        error: 'Either track_uri or track_url is required' 
      }, { status: 400 });
    }

    const { deviceId, minted: mintedDevice } = resolveGuestDeviceId(req);
    const clientIP = getClientIp(req);
    const ipHash = hashIP(clientIP);
    const eventScope = access.event?.id || 'unknown-event';
    const rateLimitCheck = await enforceGuestRateLimit({
      bucket: 'songRequest',
      primaryKey: `${eventScope}:${deviceId}`,
      secondaryKey: ipHash,
      secondaryMaxMultiplier: 15,
    });
    if (!rateLimitCheck.allowed) {
      const response = NextResponse.json(
        { error: rateLimitCheck.message, code: 'RATE_LIMITED' },
        { status: 429 }
      );
      if (rateLimitCheck.retryAfter) {
        response.headers.set('Retry-After', String(rateLimitCheck.retryAfter));
      }
      if (mintedDevice) ensureGuestDeviceCookie(response, deviceId);
      return response;
    }

    // Multi-tenant: Get user_id from username
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    const userId: string = userResult.rows[0].id;
    console.log(`👤 [${requestId}] Request for user: ${username} (${userId})`);

    let trackUri = track_uri;
    
    if (track_url && !track_uri) {
      if (track_url.includes('open.spotify.com/track/')) {
        const trackId = track_url.split('/track/')[1].split('?')[0];
        trackUri = `spotify:track:${trackId}`;
      } else if (track_url.includes('spotify:track:')) {
        trackUri = track_url;
      } else {
        return NextResponse.json({ 
          error: 'Invalid Spotify URL or URI format' 
        }, { status: 400 });
      }
    }

    if (!trackUri.startsWith('spotify:track:')) {
      return NextResponse.json({ 
        error: 'Invalid Spotify track URI format' 
      }, { status: 400 });
    }

    // Get track information from Spotify (MULTI-TENANT!)
    console.log(`🎵 [${requestId}] Getting track info from Spotify for user ${userId}...`);
    let trackInfo;
    try {
      // Extract track ID from URI (spotify:track:ID -> ID)
      const trackId = trackUri.replace('spotify:track:', '');
      trackInfo = await spotifyService.getTrack(trackId, userId);
      console.log(`✅ [${requestId}] Track info retrieved for user ${userId} (${Date.now() - startTime}ms)`);
    } catch (error) {
      console.log(`❌ [${requestId}] Failed to get track info for user ${userId} (${Date.now() - startTime}ms):`, error);
      return NextResponse.json({ 
        error: 'Unable to find track on Spotify. Please check the URL/URI.' 
      }, { status: 400 });
    }

    // Check user-specific event settings
    console.log(`⚙️ [${requestId}] Checking event settings for user ${userId}...`);
    const eventSettings = await getEventSettings(userId);
    const shouldAutoApprove = eventSettings.auto_approve;
    const shouldDeclineExplicit = Boolean(eventSettings.decline_explicit);
    console.log(`🔧 [${requestId}] Auto-approve: ${shouldAutoApprove}, Decline explicit: ${shouldDeclineExplicit}`);

    // Check if track is explicit and should be auto-declined
    if (shouldDeclineExplicit && trackInfo.explicit) {
      console.log(`🚫 [${requestId}] Track is explicit and auto-decline is enabled, rejecting request`);
      return NextResponse.json({ 
        error: 'Explicit content is not allowed. Please choose a different song.',
        explicit: true
      }, { status: 403 });
    }

    // Validate requester nickname with profanity filter
    let validatedNickname = requester_nickname || undefined;
    if (requester_nickname) {
      const validation = validateRequesterName(requester_nickname, true); // Always enable filtering
      if (!validation.isValid) {
        console.log(`🚫 [${requestId}] Nickname contains inappropriate content: "${requester_nickname}"`);
        return NextResponse.json({ 
          error: validation.reason || 'Nickname contains inappropriate language. Please choose a different name.',
        }, { status: 400 });
      }
      validatedNickname = validation.censoredName;
      if (validatedNickname !== requester_nickname) {
        console.log(`🔒 [${requestId}] Nickname censored: "${requester_nickname}" -> "${validatedNickname}"`);
      }
    }

    // Auto-approve inserts as pending then claims+queues; avoids false approved without provider success.
    const initialStatus = 'pending';
    const approvedAt = undefined;

    // SECURITY: Ensure user_id is present (multi-tenant isolation)
    if (!userId) {
      return NextResponse.json({ 
        error: 'Username is required for request submission' 
      }, { status: 400 });
    }

    const albumImageUrl = getTrackAlbumImageUrl(trackInfo) || null;
    const eventId = access.event?.id ?? null;

    console.log(`💾 [${requestId}] Creating idempotent database request...`);
    const createResult = await createIdempotentRequest({
      userId,
      eventId,
      idempotencyKey,
      track_uri: trackInfo.uri,
      track_name: trackInfo.name,
      artist_name: trackInfo.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
      album_name: trackInfo.album?.name || 'Unknown Album',
      album_image_url: albumImageUrl,
      duration_ms: trackInfo.duration_ms,
      requester_ip_hash: ipHash,
      requester_nickname: validatedNickname,
      user_session_id: user_session_id || deviceId,
      status: initialStatus,
      approved_at: approvedAt,
      duplicateCooldownMinutes: 30,
    });

    if (createResult.kind === 'duplicate_track') {
      const response = NextResponse.json(
        {
          error:
            'This track has already been requested recently. Please choose a different song.',
          code: 'DUPLICATE_TRACK',
        },
        { status: 409 }
      );
      if (mintedDevice) ensureGuestDeviceCookie(response, deviceId);
      return response;
    }

    const newRequest = createResult.request;
    const isReplay = createResult.kind === 'replay';
    console.log(
      `✅ [${requestId}] Request ${isReplay ? 'replayed' : 'created'}: ${newRequest.id} (${Date.now() - startTime}ms total)`
    );

    if (isReplay) {
      const response = NextResponse.json(
        {
          success: true,
          message: 'Your request has been submitted successfully!',
          replayed: true,
          request: {
            id: newRequest.id,
            track: {
              name: trackInfo.name,
              artists: trackInfo.artists,
              album: trackInfo.album,
              duration_ms: trackInfo.duration_ms,
            },
            status: 'pending',
          },
        },
        { status: 200 }
      );
      if (mintedDevice) ensureGuestDeviceCookie(response, deviceId);
      return response;
    }

    // 🎵 AUTO-APPROVE: claim → provider ledger → queue (concurrency-safe)
    let queueSuccess = false;
    let autoApprovedAt: string | undefined;
    if (shouldAutoApprove) {
      const {
        claimRequestForApproval,
        releaseApprovalClaim,
        createProviderOperation,
        completeProviderOperation,
        classifySpotifyQueueError,
        shouldAttemptSpotifyQueueAdd,
      } = await import('@/lib/reliability');
      let autoClaimHeld = false;
      try {
        const claimed = await claimRequestForApproval(newRequest.id, userId);
        if (claimed) {
          autoClaimHeld = true;
          const opKey = `auto-queue:${newRequest.id}`;
          const op = await createProviderOperation({
            userId,
            eventId,
            requestId: newRequest.id,
            operation: 'spotify.add_to_queue',
            idempotencyKey: opKey,
          });
          if (op.status === 'succeeded') {
            queueSuccess = true;
            autoApprovedAt = new Date().toISOString();
            await updateRequest(
              newRequest.id,
              {
                status: 'approved',
                approved_at: autoApprovedAt,
                approved_by: 'Auto-Approval System',
                spotify_added_to_queue: true,
                provider_operation_id: op.id,
                claim_started_at: null,
              },
              userId
            );
            autoClaimHeld = false;
          } else if (!shouldAttemptSpotifyQueueAdd(op.status)) {
            // PRD-06: uncertain (or other non-retryable) — no second Spotify copy.
            await updateRequest(
              newRequest.id,
              {
                status: 'queue_failed',
                queue_error_category:
                  op.error_category ??
                  (op.status === 'uncertain' ? 'uncertain_timeout' : op.status),
                provider_operation_id: op.id,
                claim_started_at: null,
              },
              userId
            );
            autoClaimHeld = false;
          } else {
            try {
              console.log(
                `🎵 [${requestId}] Auto-approved request - adding to Spotify queue for user ${userId}...`
              );
              await spotifyService.addToQueue(trackInfo.uri, undefined, userId);
              queueSuccess = true;
              autoApprovedAt = new Date().toISOString();
              await completeProviderOperation(op.id, 'succeeded');
              await updateRequest(
                newRequest.id,
                {
                  status: 'approved',
                  approved_at: autoApprovedAt,
                  approved_by: 'Auto-Approval System',
                  spotify_added_to_queue: true,
                  provider_operation_id: op.id,
                  claim_started_at: null,
                },
                userId
              );
              autoClaimHeld = false;
              console.log(
                `✅ [${requestId}] Successfully added to Spotify queue for user ${userId}`
              );
            } catch (error) {
              const category = classifySpotifyQueueError(error);
              const uncertain = category === 'uncertain_timeout';
              await completeProviderOperation(
                op.id,
                uncertain ? 'uncertain' : 'failed',
                category
              );
              await updateRequest(
                newRequest.id,
                {
                  status: 'queue_failed',
                  queue_error_category: category,
                  provider_operation_id: op.id,
                  claim_started_at: null,
                },
                userId
              );
              autoClaimHeld = false;
              console.error(
                `❌ [${requestId}] Auto-approve queue failed (${category}):`,
                error
              );
            }
          }
        }
      } catch (autoApproveError) {
        console.error(
          `❌ [${requestId}] Auto-approve crashed; releasing claim:`,
          autoApproveError
        );
        if (autoClaimHeld) {
          await releaseApprovalClaim(
            newRequest.id,
            userId,
            'queue_failed'
          ).catch((releaseError) => {
            console.error('Failed to release auto-approve claim:', releaseError);
          });
        }
      }
    }

    // 🚀 PUSHER: Trigger real-time events (USER-SPECIFIC CHANNEL)
    try {
      // Always trigger request submitted event
      if (userId) { // Only trigger if we have a userId (multi-tenant)
        await triggerRequestSubmitted({
          id: newRequest.id,
          track_name: trackInfo.name,
          artist_name: trackInfo.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
          album_name: trackInfo.album?.name || 'Unknown Album',
          album_image_url: albumImageUrl,
          track_uri: trackInfo.uri,
          requester_nickname: validatedNickname || 'Anonymous',
          submitted_at: new Date().toISOString(),
          userId: userId // ✅ USER-SPECIFIC CHANNEL
        });
      }
      console.log(`🎉 Pusher event sent for new request: ${trackInfo.name}`);

      // If auto-approved and queued, also trigger approval event
      if (shouldAutoApprove && queueSuccess && userId && autoApprovedAt) {
        await triggerRequestApproved({
          id: newRequest.id,
          track_name: trackInfo.name,
          artist_name: trackInfo.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
          album_name: trackInfo.album?.name || 'Unknown Album',
          track_uri: trackInfo.uri,
          requester_nickname: validatedNickname || 'Anonymous',
          user_session_id: user_session_id || deviceId,
          play_next: false,
          approved_at: autoApprovedAt,
          approved_by: 'Auto-Approval System',
          userId: userId
        });
        console.log(`🎉 Auto-approval Pusher event sent for: ${trackInfo.name}`);
      }
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event for new request:', pusherError);
      // Don't fail the request if Pusher fails
    }

    // 📢 AUTO-MESSAGE: Queue Notice Board message if auto-approved and enabled
    if (shouldAutoApprove && queueSuccess && userId) {
      try {
        const eventSettings = await getEventSettings(userId);
        
        if (eventSettings.show_approval_messages) {
          const requesterName = validatedNickname || 'Anonymous';
          const artistName = trackInfo.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist';
          const trackName = trackInfo.name;
          
          const messageText = `${requesterName}\n\nhas requested\n\n${trackName}\nby\n${artistName}\n\nAdded to the\nParty Playlist!`;
          
          console.log(`📢 [${requestId}] Queueing auto-approval message: "${messageText.substring(0, 50)}..."`);
          
          // Add message to queue (10 seconds duration as documented)
          await messageQueue.addMessage(userId, messageText, 10);
          
          console.log(`✅ [${requestId}] Auto-approval message queued successfully`);
        }
      } catch (messageError) {
        console.error(`❌ [${requestId}] Failed to queue auto-approval message:`, messageError);
        // Don't fail the request if message fails
      }
    }

    // Use generic message - don't reveal auto-approval to users
    const responseMessage = 'Your request has been submitted successfully!';

    reportActivity(req, 'request.submit', `Guest submitted ${trackInfo.name}`, {
      actorRole: 'guest',
      userId,
      username: username || null,
      meta: {
        requestId: newRequest.id,
        track: trackInfo.name,
        autoApproved: shouldAutoApprove,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: responseMessage,
      request: {
        id: newRequest.id,
        track: {
          name: trackInfo.name,
          artists: trackInfo.artists,
          album: trackInfo.album,
          duration_ms: trackInfo.duration_ms
        },
        status: 'pending' // Always show as pending to users, regardless of auto-approval
      }
    }, { status: 201 });
    if (mintedDevice) ensureGuestDeviceCookie(response, deviceId);
    return response;

  } catch (error) {
    console.error(`❌ [${requestId}] Error submitting request (${Date.now() - startTime}ms):`, error);
    console.error(`❌ [${requestId}] Error stack:`, (error as Error).stack);
    console.error(`❌ [${requestId}] Error message:`, (error as Error).message);
    reportApiError(req, error);
    return NextResponse.json({ 
      error: 'Failed to submit request. Please try again.',
      debug: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}