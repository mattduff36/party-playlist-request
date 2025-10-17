import { NextRequest, NextResponse } from 'next/server';
import { createRequest, hashIP, checkRecentDuplicate, initializeDefaults, getEventSettings, updateRequest } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestSubmitted, triggerRequestApproved } from '@/lib/pusher';
import { messageQueue } from '@/lib/message-queue';
import { validateRequesterName } from '@/lib/profanity-filter';

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number; lastRequest: number }>();

function isRateLimited(ip: string): { limited: boolean; message?: string } {
  const now = Date.now();
  const ipHash = hashIP(ip);
  const current = rateLimitMap.get(ipHash) || { count: 0, resetTime: now + 60 * 60 * 1000, lastRequest: 0 };

  // Check hourly limit (10 requests per hour)
  if (now > current.resetTime) {
    current.count = 0;
    current.resetTime = now + 60 * 60 * 1000;
  }

  if (current.count >= 10) {
    return { limited: true, message: 'Maximum 10 requests per hour exceeded. Please try again later.' };
  }

  // Check 5-second cooldown (reduced for testing)
  if (now - current.lastRequest < 5 * 1000) {
    return { limited: true, message: 'Please wait 5 seconds before making another request.' };
  }

  current.count++;
  current.lastRequest = now;
  rateLimitMap.set(ipHash, current);

  return { limited: false };
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🎵 [${requestId}] Request endpoint called`);
  const startTime = Date.now();
  
  try {
    console.log(`⏱️ [${requestId}] Initializing defaults...`);
    await initializeDefaults();
    console.log(`✅ [${requestId}] Defaults initialized (${Date.now() - startTime}ms)`);

    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    
    // Rate limiting
    const rateLimitCheck = isRateLimited(clientIP);
    if (rateLimitCheck.limited) {
      return NextResponse.json({ error: rateLimitCheck.message }, { status: 429 });
    }

    const body = await req.json();
    const { track_uri, track_url, requester_nickname, user_session_id, username } = body;
    
    if (!track_uri && !track_url) {
      return NextResponse.json({ 
        error: 'Either track_uri or track_url is required' 
      }, { status: 400 });
    }

    // Multi-tenant: Get user_id from username
    let userId: string | null = null;
    if (username) {
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

      userId = userResult.rows[0].id;
      console.log(`👤 [${requestId}] Request for user: ${username} (${userId})`);
    }

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

    // Check for recent duplicates using efficient database query (MULTI-TENANT!)
    console.log(`🔍 [${requestId}] Checking for recent duplicates for user ${userId}...`);
    const recentDuplicate = await checkRecentDuplicate(trackUri, 30, userId);
    console.log(`✅ [${requestId}] Duplicate check completed for user ${userId} (${Date.now() - startTime}ms)`);

    if (recentDuplicate) {
      console.log(`⚠️ [${requestId}] Duplicate found, rejecting request`);
      return NextResponse.json({ 
        error: 'This track has already been requested recently. Please choose a different song.' 
      }, { status: 409 });
    }

    const ipHash = hashIP(clientIP);

    // Check user-specific event settings
    console.log(`⚙️ [${requestId}] Checking event settings for user ${userId}...`);
    const eventSettings = await getEventSettings(userId);
    const shouldAutoApprove = eventSettings.auto_approve;
    const shouldDeclineExplicit = (eventSettings as any).decline_explicit || false;
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

    // Determine initial status based on auto-approval setting
    const initialStatus = shouldAutoApprove ? 'approved' : 'pending';
    const approvedAt = shouldAutoApprove ? new Date().toISOString() : undefined;

    // SECURITY: Ensure user_id is present (multi-tenant isolation)
    if (!userId) {
      return NextResponse.json({ 
        error: 'Username is required for request submission' 
      }, { status: 400 });
    }

    console.log(`💾 [${requestId}] Creating database request with status: ${initialStatus}...`);
    const newRequest = await createRequest({
      track_uri: trackInfo.uri,
      track_name: trackInfo.name,
      artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      album_name: trackInfo.album?.name || 'Unknown Album',
      duration_ms: trackInfo.duration_ms,
      requester_ip_hash: ipHash,
      requester_nickname: validatedNickname,
      user_session_id: user_session_id || undefined,
      status: initialStatus,
      approved_at: approvedAt,
      approved_by: shouldAutoApprove ? 'Auto-Approval System' : undefined,
      spotify_added_to_queue: false,
      spotify_added_to_playlist: false,
    }, userId); // SECURITY: Pass userId as second parameter for multi-tenant isolation
    console.log(`✅ [${requestId}] Request created successfully with status: ${initialStatus} (${Date.now() - startTime}ms total)`);

    // 🎵 AUTO-QUEUE: If auto-approved, try to add to Spotify queue (MULTI-TENANT!)
    let queueSuccess = false;
    if (shouldAutoApprove) {
      try {
        console.log(`🎵 [${requestId}] Auto-approved request - adding to Spotify queue for user ${userId}...`);
        await spotifyService.addToQueue(trackInfo.uri, undefined, userId);
        queueSuccess = true;
        console.log(`✅ [${requestId}] Successfully added to Spotify queue for user ${userId}`);
        
        // Update the request to mark it as added to queue
        await updateRequest(newRequest.id, {
          spotify_added_to_queue: true
        });
      } catch (error) {
        console.error(`❌ [${requestId}] Failed to add auto-approved request to Spotify queue:`, error);
        // Don't fail the request if Spotify queue fails - the request is still approved
      }
    }

    // 🚀 PUSHER: Trigger real-time events (USER-SPECIFIC CHANNEL)
    try {
      // Always trigger request submitted event
      if (userId) { // Only trigger if we have a userId (multi-tenant)
        await triggerRequestSubmitted({
          id: newRequest.id,
          track_name: trackInfo.name,
          artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
          album_name: trackInfo.album?.name || 'Unknown Album',
          track_uri: trackInfo.uri,
          requester_nickname: validatedNickname || 'Anonymous',
          submitted_at: new Date().toISOString(),
          userId: userId // ✅ USER-SPECIFIC CHANNEL
        });
      }
      console.log(`🎉 Pusher event sent for new request: ${trackInfo.name}`);

      // If auto-approved, also trigger approval event
      if (shouldAutoApprove && userId) {
        await triggerRequestApproved({
          id: newRequest.id,
          track_name: trackInfo.name,
          artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
          album_name: trackInfo.album?.name || 'Unknown Album',
          track_uri: trackInfo.uri,
          requester_nickname: validatedNickname || 'Anonymous',
          user_session_id: user_session_id || undefined,
          play_next: false, // Default to false for auto-approved requests
          approved_at: approvedAt!,
          approved_by: 'Auto-Approval System',
          userId: userId // ✅ USER-SPECIFIC CHANNEL
        });
        console.log(`🎉 Auto-approval Pusher event sent for: ${trackInfo.name}`);
      }
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event for new request:', pusherError);
      // Don't fail the request if Pusher fails
    }

    // 📢 AUTO-MESSAGE: Queue Notice Board message if auto-approved and enabled
    if (shouldAutoApprove && userId) {
      try {
        const eventSettings = await getEventSettings(userId);
        
        if (eventSettings.show_approval_messages) {
          const requesterName = requester_nickname || 'Anonymous';
          const artistName = trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
          const trackName = trackInfo.name;
          
          const messageText = `${requesterName}\n\nhas requested\n\n${trackName}\nby\n${artistName}\n\nAdded to the\nParty Playlist!`;
          
          console.log(`📢 [${requestId}] Queueing auto-approval message: "${messageText.substring(0, 50)}..."`);
          
          // Add message to queue (8 seconds duration to avoid auto-close)
          await messageQueue.addMessage(userId, messageText, 8);
          
          console.log(`✅ [${requestId}] Auto-approval message queued successfully`);
        }
      } catch (messageError) {
        console.error(`❌ [${requestId}] Failed to queue auto-approval message:`, messageError);
        // Don't fail the request if message fails
      }
    }

    // Use generic message - don't reveal auto-approval to users
    const responseMessage = 'Your request has been submitted successfully!';

    return NextResponse.json({
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

  } catch (error) {
    console.error(`❌ [${requestId}] Error submitting request (${Date.now() - startTime}ms):`, error);
    console.error(`❌ [${requestId}] Error stack:`, (error as Error).stack);
    console.error(`❌ [${requestId}] Error message:`, (error as Error).message);
    return NextResponse.json({ 
      error: 'Failed to submit request. Please try again.',
      debug: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}