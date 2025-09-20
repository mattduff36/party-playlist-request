import { NextRequest, NextResponse } from 'next/server';
import { createRequest, hashIP, checkRecentDuplicate, initializeDefaults } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { triggerRequestSubmitted } from '@/lib/pusher';

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

    console.log(`💾 [${requestId}] Creating database request...`);
    const newRequest = await createRequest({
      track_uri: trackInfo.uri,
      track_name: trackInfo.name,
      artist_name: trackInfo.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      album_name: trackInfo.album?.name || 'Unknown Album',
      duration_ms: trackInfo.duration_ms,
      requester_ip_hash: ipHash,
      requester_nickname: requester_nickname || undefined,
      user_session_id: user_session_id || undefined,
      status: 'pending',
      spotify_added_to_queue: false,
      spotify_added_to_playlist: false
    });
    console.log(`✅ [${requestId}] Request created successfully (${Date.now() - startTime}ms total)`);

    // 🚀 PUSHER: Trigger real-time event for new request submission
    try {
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
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event for new request:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: 'Your request has been submitted successfully!',
      request: {
        id: newRequest.id,
        track: {
          name: trackInfo.name,
          artists: trackInfo.artists,
          album: trackInfo.album,
          duration_ms: trackInfo.duration_ms
        },
        status: 'pending'
      }
    }, { status: 201 });

  } catch (error) {
    console.error(`❌ [${requestId}] Error submitting request (${Date.now() - startTime}ms):`, error);
    return NextResponse.json({ 
      error: 'Failed to submit request. Please try again.' 
    }, { status: 500 });
  }
}