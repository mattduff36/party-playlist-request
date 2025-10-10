import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🎵 [playback/skip] User ${auth.user.username} (${userId}) skipping track`);
    
    // Handle empty request body gracefully
    let device_id;
    try {
      const body = await req.json();
      device_id = body.device_id;
    } catch (jsonError) {
      // No JSON body provided, use undefined device_id
      device_id = undefined;
    }
    
    await spotifyService.skipToNext(device_id, userId);
    
    return NextResponse.json({
      success: true,
      message: 'Skipped to next track'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error skipping track:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to skip track';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle common Spotify playback errors
      if (error.message.includes('NO_ACTIVE_DEVICE')) {
        errorMessage = 'No active Spotify device found. Please start playing music on a Spotify device first.';
      } else if (error.message.includes('PREMIUM_REQUIRED')) {
        errorMessage = 'Spotify Premium is required for playback control.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Insufficient permissions for playback control. Please re-authenticate with Spotify.';
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}