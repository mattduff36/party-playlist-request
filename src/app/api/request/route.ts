import { NextRequest, NextResponse } from 'next/server';
import { createRequest, hashIP, checkRecentDuplicate, initializeDefaults, getEventSettings, updateRequest } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestSubmitted, triggerRequestApproved } from '@/lib/pusher';

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
    const { track_uri, track_url, requester_nickname, user_session_id } = body;
    
    if (!track_uri && !track_url) {
      return NextResponse.json({ 
        error: 'Either track_uri or track_url is required' 
      }, { status: 400 });
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

    // Get track information from Spotify
    console.log(`🎵 [${requestId}] Getting track info from Spotify...`);
    let trackInfo;
    try {
      // Extract track ID from URI (spotify:track:ID -> ID)
      const trackId = trackUri.replace('spotify:track:', '');
      trackInfo = await spotifyService.getTrack(trackId);
      console.log(`✅ [${requestId}] Track info retrieved (${Date.now() - startTime}ms)`);
    } catch (error) {
      console.log(`❌ [${requestId}] Failed to get track info (${Date.now() - startTime}ms):`, error);
      return NextResponse.json({ 
        error: 'Unable to find track on Spotify. Please check the URL/URI.' 
      }, { status: 400 });
    }

    // Check for recent duplicates using efficient database query
    console.log(`🔍 [${requestId}] Checking for recent duplicates...`);
    const recentDuplicate = await checkRecentDuplicate(trackUri, 30);
    console.log(`✅ [${requestId}] Duplicate check completed (${Date.now() - startTime}ms)`);

    if (recentDuplicate) {
      console.log(`⚠️ [${requestId}] Duplicate found, rejecting request`);
      return NextResponse.json({ 
        error: 'This track has already been requested recently. Please choose a different song.' 
      }, { status: 409 });
    }

    const ipHash = hashIP(clientIP);

    // Check if auto-approval is enabled
    console.log(`⚙️ [${requestId}] Checking auto-approval settings...`);
    const eventSettings = await getEventSettings();
    const shouldAutoApprove = eventSettings.auto_approve;
    console.log(`🔧 [${requestId}] Auto-approve setting: ${shouldAutoApprove}`);

    // Determine initial status based on auto-approval setting
    const initialStatus = shouldAutoApprove ? 'approved' : 'pending';
    const approvedAt = shouldAutoApprove ? new Date().toISOString() : undefined;

    console.log(`💾 [${requestId}] Creating database request with status: ${initialStatus}...`);
    const newRequest = await createRequest({
      track_uri: trackInfo.uri,
      track_name: trackInfo.name,
      artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      album_name: trackInfo.album?.name || 'Unknown Album',
      duration_ms: trackInfo.duration_ms,
      requester_ip_hash: ipHash,
      requester_nickname: requester_nickname || undefined,
      user_session_id: user_session_id || undefined,
      status: initialStatus,
      approved_at: approvedAt,
      approved_by: shouldAutoApprove ? 'Auto-Approval System' : undefined,
      spotify_added_to_queue: false,
      spotify_added_to_playlist: false
    });
    console.log(`✅ [${requestId}] Request created successfully with status: ${initialStatus} (${Date.now() - startTime}ms total)`);

    // 🎵 AUTO-QUEUE: If auto-approved, try to add to Spotify queue
    let queueSuccess = false;
    if (shouldAutoApprove) {
      try {
        console.log(`🎵 [${requestId}] Auto-approved request - adding to Spotify queue...`);
        await spotifyService.addToQueue(trackInfo.uri);
        queueSuccess = true;
        console.log(`✅ [${requestId}] Successfully added to Spotify queue`);
        
        // Update the request to mark it as added to queue
        await updateRequest(newRequest.id, {
          spotify_added_to_queue: true
        });
      } catch (error) {
        console.error(`❌ [${requestId}] Failed to add auto-approved request to Spotify queue:`, error);
        // Don't fail the request if Spotify queue fails - the request is still approved
      }
    }

    // 🚀 PUSHER: Trigger real-time events
    try {
      // Always trigger request submitted event
      await triggerRequestSubmitted({
        id: newRequest.id,
        track_name: trackInfo.name,
        artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album_name: trackInfo.album?.name || 'Unknown Album',
        track_uri: trackInfo.uri,
        requester_nickname: requester_nickname || 'Anonymous',
        submitted_at: new Date().toISOString()
      });
      console.log(`🎉 Pusher event sent for new request: ${trackInfo.name}`);

      // If auto-approved, also trigger approval event
      if (shouldAutoApprove) {
        await triggerRequestApproved({
          id: newRequest.id,
          track_name: trackInfo.name,
          artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
          album_name: trackInfo.album?.name || 'Unknown Album',
          track_uri: trackInfo.uri,
          requester_nickname: requester_nickname || 'Anonymous',
          user_session_id: user_session_id || undefined,
          play_next: false, // Default to false for auto-approved requests
          approved_at: approvedAt!,
          approved_by: 'Auto-Approval System'
        });
        console.log(`🎉 Auto-approval Pusher event sent for: ${trackInfo.name}`);
      }
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event for new request:', pusherError);
      // Don't fail the request if Pusher fails
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
    return NextResponse.json({ 
      error: 'Failed to submit request. Please try again.' 
    }, { status: 500 });
  }
}