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
    const auth = requireAuth(request);
    
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

    // Check if THIS USER is permanently disconnected
    if (isSpotifyPermanentlyDisconnected()) {
      return NextResponse.json({
        connected: false,
        is_playing: false,
        current_track: null,
        device: null,
        error: 'Not connected to Spotify',
        status_message: getConnectionStatusMessage(),
        requires_manual_reconnect: true,
        last_updated: new Date().toISOString()
      });
    }

    // Check if THIS USER is connected and get status (MULTI-TENANT!)
    const isConnected = await spotifyService.isConnectedAndValid(userId);
    
    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        is_playing: false,
        current_track: null,
        device: null,
        error: 'Not connected to Spotify',
        status_message: getConnectionStatusMessage(),
        requires_manual_reconnect: false,
        last_updated: new Date().toISOString()
      });
    }

    // Get current playback status (MULTI-TENANT!)
    const playback = await spotifyService.getCurrentPlayback(userId);
    const queue = await spotifyService.getQueue(userId);

    return NextResponse.json({
      connected: true,
      is_playing: playback?.is_playing || false,
      current_track: playback?.item ? {
        name: playback.item.name,
        artist: playback.item.artists?.[0]?.name || 'Unknown Artist',
        album: playback.item.album?.name || 'Unknown Album',
        image_url: playback.item.album?.images?.[0]?.url,
        duration_ms: playback.item.duration_ms || 0,
        progress_ms: playback.progress_ms || 0
      } : null,
      device: playback?.device ? {
        name: playback.device.name,
        type: playback.device.type,
        volume_percent: playback.device.volume_percent || 0
      } : null,
      queue: queue?.queue || [],
      error: null,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    // Don't log errors for expected disconnection states
    const errorMessage = error instanceof Error ? error.message : 'Failed to get Spotify status';
    const isExpectedError = errorMessage.includes('disconnected') || 
                           errorMessage.includes('backoff') ||
                           errorMessage.includes('No refresh token');
    
    if (!isExpectedError) {
      console.error('Spotify status error:', error);
    }
    
    return NextResponse.json({
      connected: false,
      is_playing: false,
      current_track: null,
      device: null,
      error: 'Not connected to Spotify',
      status_message: getConnectionStatusMessage(),
      last_updated: new Date().toISOString()
    }, { status: 200 }); // Return 200 for disconnected state - it's not an error
  }
}
