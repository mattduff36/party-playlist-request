import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication first
    await authService.requireAdminAuth(req);
    
    // Try to get Spotify data, but handle connection issues gracefully
    let playbackState = null;
    let queueData = null;
    let spotifyConnected = true;
    
    try {
      [playbackState, queueData] = await Promise.all([
        spotifyService.getCurrentPlayback(),
        spotifyService.getQueue()
      ]);
    } catch (spotifyError) {
      // Spotify connection issues - return empty data but don't fail
      spotifyConnected = false;
      console.log('Spotify not connected or error:', spotifyError);
    }
    
    // Process current track with album art
    let currentTrack = null;
    if (playbackState?.item && spotifyConnected) {
      try {
        const albumArt = await spotifyService.getAlbumArt(playbackState.item.uri);
        currentTrack = {
          ...playbackState.item,
          image_url: albumArt,
          progress_ms: playbackState.progress_ms,
          is_playing: playbackState.is_playing
        };
      } catch (artError) {
        // Fallback without album art
        currentTrack = {
          ...playbackState.item,
          image_url: null,
          progress_ms: playbackState.progress_ms,
          is_playing: playbackState.is_playing
        };
      }
    }
    
    // Process queue items with album art
    let queueItems = [];
    if (queueData?.queue && spotifyConnected) {
      queueItems = await Promise.all(
        queueData.queue.slice(0, 10).map(async (item: any) => {
          try {
            const albumArt = await spotifyService.getAlbumArt(item.uri);
            return {
              ...item,
              image_url: albumArt
            };
          } catch (artError) {
            // Fallback without album art
            return {
              ...item,
              image_url: null
            };
          }
        })
      );
    }
    
    return NextResponse.json({
      current_track: currentTrack,
      queue: queueItems,
      device: playbackState?.device || null,
      is_playing: playbackState?.is_playing || false,
      shuffle_state: playbackState?.shuffle_state || false,
      repeat_state: playbackState?.repeat_state || 'off',
      spotify_connected: spotifyConnected
    });
    
  } catch (error) {
    // Only return 401 for admin authentication errors
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Error getting queue details:', error);
    return NextResponse.json({ 
      error: 'Failed to get queue details' 
    }, { status: 500 });
  }
}
