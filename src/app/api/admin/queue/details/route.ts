import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication first
    await authService.requireAdminAuth(req);
    
    // Check if Spotify is connected first to avoid repeated failed attempts
    const spotifyConnected = await spotifyService.isConnected();
    let playbackState = null;
    let queueData = null;
    
    if (spotifyConnected) {
      try {
        [playbackState, queueData] = await Promise.all([
          spotifyService.getCurrentPlayback(),
          spotifyService.getQueue()
        ]);
      } catch (spotifyError) {
        // Spotify API call failed - log but don't spam console
        console.log('Spotify API error (will retry next poll):', (spotifyError as Error).message);
      }
    }
    
    // Process current track with album art
    let currentTrack = null;
    if (playbackState?.item && spotifyConnected) {
      try {
        const albumArt = await spotifyService.getAlbumArt(playbackState.item.uri);
        currentTrack = {
          id: playbackState.item.id,
          uri: playbackState.item.uri,
          name: playbackState.item.name,
          artists: playbackState.item.artists.map((artist: any) => artist.name),
          album: playbackState.item.album.name,
          duration_ms: playbackState.item.duration_ms,
          explicit: playbackState.item.explicit,
          external_urls: playbackState.item.external_urls,
          image_url: albumArt,
          progress_ms: playbackState.progress_ms,
          is_playing: playbackState.is_playing
        };
      } catch (artError) {
        // Fallback without album art
        currentTrack = {
          id: playbackState.item.id,
          uri: playbackState.item.uri,
          name: playbackState.item.name,
          artists: playbackState.item.artists.map((artist: any) => artist.name),
          album: playbackState.item.album.name,
          duration_ms: playbackState.item.duration_ms,
          explicit: playbackState.item.explicit,
          external_urls: playbackState.item.external_urls,
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
              id: item.id,
              uri: item.uri,
              name: item.name,
              artists: item.artists.map((artist: any) => artist.name),
              album: item.album.name,
              duration_ms: item.duration_ms,
              explicit: item.explicit,
              external_urls: item.external_urls,
              image_url: albumArt
            };
          } catch (artError) {
            // Fallback without album art
            return {
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
