/**
 * Spotify Status API Route
 * 
 * Returns the current Spotify connection status and playback information
 */

import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  try {
    // MULTI-TENANT: Need userId from authenticated session or username param
    const { requireAuth } = await import('@/middleware/auth');
    const auth = await requireAuth(request);
    
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({
        connected: false,
        is_playing: false,
        current_track: null,
        device: null,
        error: 'Authentication required',
        last_updated: new Date().toISOString()
      }, { status: 401 });
    }

    const userId = auth.user.user_id;

    // Check if THIS USER is connected and get status (MULTI-TENANT!)
    const isConnected = await spotifyService.isConnectedAndValid(userId);
    
    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        is_playing: false,
        current_track: null,
        device: null,
        error: 'Not connected to Spotify',
        last_updated: new Date().toISOString()
      });
    }

    // Get current playback status (MULTI-TENANT!)
    let playback: Awaited<
      ReturnType<typeof spotifyService.getCurrentPlayback>
    > = null;
    let queue: Awaited<ReturnType<typeof spotifyService.getQueue>> = null;
    let rateLimited = false;

    try {
      playback = await spotifyService.getCurrentPlayback(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.includes('429') ||
        message.includes('backoff') ||
        message.includes('rate limited')
      ) {
        rateLimited = true;
      } else {
        throw error;
      }
    }

    if (!rateLimited) {
      try {
        queue = await spotifyService.getQueue(userId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (
          message.includes('429') ||
          message.includes('backoff') ||
          message.includes('rate limited')
        ) {
          rateLimited = true;
        } else {
          throw error;
        }
      }
    }

    // Fallback when /me/player is briefly 204 but queue still knows the track
    const item = playback?.item || queue?.currently_playing || null;

    const response = NextResponse.json({
      connected: true,
      is_playing: playback?.is_playing || false,
      current_track: item ? {
        name: item.name,
        artist: item.artists?.[0]?.name || 'Unknown Artist',
        album: item.album?.name || 'Unknown Album',
        image_url: item.album?.images?.[0]?.url,
        duration_ms: item.duration_ms || 0,
        progress_ms: playback?.progress_ms || 0
      } : null,
      device: playback?.device ? {
        name: playback.device.name,
        type: playback.device.type,
        volume_percent: playback.device.volume_percent || 0
      } : null,
      queue: queue?.queue || [],
      error: rateLimited ? 'Spotify rate limited (backoff)' : null,
      last_updated: new Date().toISOString()
    });
    
    // OPTIMIZATION: Add cache headers (10 seconds for rapidly changing data)
    response.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
    response.headers.set('CDN-Cache-Control', 'private, max-age=10');
    
    return response;

  } catch (error) {
    // Don't log errors for expected disconnection states
    const errorMessage = error instanceof Error ? error.message : 'Failed to get Spotify status';
    const isRateLimited =
      errorMessage.includes('429') ||
      errorMessage.includes('backoff') ||
      errorMessage.includes('rate limited');
    const isExpectedError =
      isRateLimited ||
      errorMessage.includes('disconnected') ||
      errorMessage.includes('No refresh token');
    
    if (!isExpectedError) {
      console.error('Spotify status error:', error);
    }

    // Rate limits are transient — stay "connected" so UI does not flap offline
    return NextResponse.json({
      connected: isRateLimited,
      is_playing: false,
      current_track: null,
      device: null,
      error: errorMessage,
      last_updated: new Date().toISOString()
    }, { status: 200 }); // Return 200 for disconnected state - it's not an error
  }
}
