import { NextRequest, NextResponse } from 'next/server';
import { createRequest, hashIP, getAllRequests, initializeDefaults } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

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

  // Check 30-second cooldown
  if (now - current.lastRequest < 30 * 1000) {
    return { limited: true, message: 'Please wait 30 seconds before making another request.' };
  }

  current.count++;
  current.lastRequest = now;
  rateLimitMap.set(ipHash, current);

  return { limited: false };
}

export async function POST(req: NextRequest) {
  try {
    await initializeDefaults();

    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    
    // Rate limiting
    const rateLimitCheck = isRateLimited(clientIP);
    if (rateLimitCheck.limited) {
      return NextResponse.json({ error: rateLimitCheck.message }, { status: 429 });
    }

    const body = await req.json();
    const { track_uri, track_url, requester_nickname } = body;
    
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
    let trackInfo;
    try {
      trackInfo = await spotifyService.getTrack(trackUri);
    } catch (error) {
      return NextResponse.json({ 
        error: 'Unable to find track on Spotify. Please check the URL/URI.' 
      }, { status: 400 });
    }

    // Check for recent duplicates
    const recentRequests = await getAllRequests(50);
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const recentDuplicate = recentRequests.find(r => 
      r.track_uri === trackUri && 
      new Date(r.created_at).getTime() > thirtyMinutesAgo &&
      ['pending', 'approved', 'queued'].includes(r.status)
    );

    if (recentDuplicate) {
      return NextResponse.json({ 
        error: 'This track has already been requested recently. Please choose a different song.' 
      }, { status: 409 });
    }

    const ipHash = hashIP(clientIP);

    const newRequest = await createRequest({
      track_uri: trackInfo.uri,
      track_name: trackInfo.name,
      artist_name: trackInfo.artists.join(', '),
      album_name: trackInfo.album,
      duration_ms: trackInfo.duration_ms,
      requester_ip_hash: ipHash,
      requester_nickname: requester_nickname || undefined,
      status: 'pending'
    });

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
    console.error('Error submitting request:', error);
    return NextResponse.json({ 
      error: 'Failed to submit request. Please try again.' 
    }, { status: 500 });
  }
}