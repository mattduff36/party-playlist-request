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
    const { device_id, play } = await req.json();

    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id is required' },
        { status: 400 }
      );
    }

    console.log(`🎵 [transfer-playback] User ${auth.user.username} transferring playback to device ${device_id}`);
    
    await spotifyService.transferPlayback(device_id, play || false, userId);
    
    return NextResponse.json({
      success: true,
      message: 'Playback transferred successfully'
    });

  } catch (error) {
    console.error('Error transferring playback:', error);
    
    let errorMessage = 'Failed to transfer playback';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle common Spotify errors
      if (error.message.includes('NO_ACTIVE_DEVICE')) {
        errorMessage = 'Selected device is not available. Please open Spotify on the device first.';
      } else if (error.message.includes('PREMIUM_REQUIRED')) {
        errorMessage = 'Spotify Premium is required for playback control.';
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

