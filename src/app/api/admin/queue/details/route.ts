import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  console.log('🔍 Queue details endpoint called');
  
  try {
    // Verify admin authentication first
    await authService.requireAdminAuth(req);
    console.log(`✅ Admin auth verified (${Date.now() - startTime}ms)`);
    
    // Get both current playback and queue - let Spotify API calls handle their own auth
    console.log('🎵 Fetching Spotify playback and queue data...');
    const spotifyCallStart = Date.now();
    
    let playbackState = null;
    let queueData = null;
    let spotifyConnected = true; // Assume connected, let API calls determine if not
    
    try {
      [playbackState, queueData] = await Promise.all([
        spotifyService.getCurrentPlayback(),
        spotifyService.getQueue()
      ]);
      console.log(`🎵 Spotify data fetched successfully (${Date.now() - spotifyCallStart}ms)`);
    } catch (spotifyError) {
      const errorMessage = (spotifyError as Error).message;
      console.log(`❌ Spotify API error: ${errorMessage}`);
      
      // Mark as disconnected if we get auth errors
      if (errorMessage.includes('token') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        spotifyConnected = false;
        console.log('🔄 Spotify auth error detected, marking as disconnected');
      } else {
        // For other errors (timeouts, network issues), still return empty data but log differently
        console.log('⚠️ Spotify API call failed, returning empty data');
        spotifyConnected = false;
      }
      
      playbackState = null;
      queueData = null;
    }
    
    // Process current track with album art
    let currentTrack = null;
    if (playbackState?.item) {
      // Create basic track info first
      currentTrack = {
        id: playbackState.item.id,
        uri: playbackState.item.uri,
        name: playbackState.item.name,
        artists: playbackState.item.artists.map((artist: any) => artist.name),
        album: playbackState.item.album.name,
        duration_ms: playbackState.item.duration_ms,
        explicit: playbackState.item.explicit,
        external_urls: playbackState.item.external_urls,
        image_url: null, // Default to null
        progress_ms: playbackState.progress_ms,
        is_playing: playbackState.is_playing
      };

      // Try to get album art, but don't fail if there are issues
      try {
        const albumArt = await spotifyService.getAlbumArt(playbackState.item.uri);
        currentTrack.image_url = albumArt;
      } catch (artError) {
        console.log('Could not fetch album art:', (artError as Error).message);
      }
    }
    
    // Process queue items with album art
    let queueItems = [];
    if (queueData?.queue) {
      queueItems = await Promise.all(
        queueData.queue.slice(0, 10).map(async (item: any) => {
          const queueItem = {
            id: item.id,
            uri: item.uri,
            name: item.name,
            artists: item.artists.map((artist: any) => artist.name),
            album: item.album.name,
            duration_ms: item.duration_ms,
            explicit: item.explicit,
            external_urls: item.external_urls,
            image_url: null
          };
          
          // Try to get album art for each item
          try {
            const albumArt = await spotifyService.getAlbumArt(item.uri);
            queueItem.image_url = albumArt;
          } catch (artError) {
            // Album art is optional, continue without it
            console.log(`Could not fetch album art for ${item.name}:`, (artError as Error).message);
          }
          
          return queueItem;
        })
      );
    }
    
    console.log(`🎯 Queue details endpoint completed (${Date.now() - startTime}ms total)`);
    
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
    console.error(`❌ Error in queue details endpoint (${Date.now() - startTime}ms):`, error);
    
    // Only return 401 for admin authentication errors
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to get queue details',
      spotify_connected: false
    }, { status: 500 });
  }
}
