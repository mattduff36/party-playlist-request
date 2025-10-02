/**
 * Spotify Status API Route
 * 
 * Returns the current Spotify connection status and playback information
 */

import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  try {
    // Check if connected and get status
    const isConnected = await spotifyService.isConnectedAndValid();
    
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

    // Get current playback status
    const playback = await spotifyService.getCurrentPlayback();
    const queue = await spotifyService.getQueue();

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
    console.error('Spotify status error:', error);
    
    return NextResponse.json({
      connected: false,
      is_playing: false,
      current_track: null,
      device: null,
      error: error instanceof Error ? error.message : 'Failed to get Spotify status',
      last_updated: new Date().toISOString()
    }, { status: 500 });
  }
}
