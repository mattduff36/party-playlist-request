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
    
    // Check if Spotify is connected first to avoid repeated failed attempts
    const connectionCheckStart = Date.now();
    let spotifyConnected = await spotifyService.isConnected();
    console.log(`🎵 Spotify connection check: ${spotifyConnected} (${Date.now() - connectionCheckStart}ms)`);
    
    let playbackState = null;
    let queueData = null;
    
    if (spotifyConnected) {
      try {
        const spotifyCallStart = Date.now();
        console.log('🎵 Fetching Spotify playback and queue data...');
        
        [playbackState, queueData] = await Promise.all([
          spotifyService.getCurrentPlayback(),
          spotifyService.getQueue()
        ]);
        
        console.log(`🎵 Spotify data fetched (${Date.now() - spotifyCallStart}ms)`);
      } catch (spotifyError) {
        // If we get auth errors, mark as disconnected
        const errorMessage = (spotifyError as Error).message;
        console.log(`❌ Spotify error: ${errorMessage}`);
        
        if (errorMessage.includes('No Spotify authentication found') || 
            errorMessage.includes('Failed to refresh access token')) {
          console.log('🔄 Spotify authentication invalid, marking as disconnected');
          spotifyConnected = false;
          playbackState = null;
          queueData = null;
        } else {
          console.log('⚠️ Spotify API error (will retry next poll):', errorMessage);
        }
      }
    }
    
    // Process current track (skip album art if auth issues detected)
    let currentTrack = null;
    if (playbackState?.item && spotifyConnected) {
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

      // Try to get album art, but don't fail if auth issues
      try {
        const albumArt = await spotifyService.getAlbumArt(playbackState.item.uri);
        currentTrack.image_url = albumArt;
      } catch (artError) {
        // Log but don't fail - album art is optional
        console.log('Could not fetch album art (auth may be invalid):', (artError as Error).message);
      }
    }
    
    // Process queue items (album art is optional)
    let queueItems = [];
    if (queueData?.queue && spotifyConnected) {
      queueItems = queueData.queue.slice(0, 10).map((item: any) => {
        // Create basic item info first
        const queueItem = {
          id: item.id,
          uri: item.uri,
          name: item.name,
          artists: item.artists.map((artist: any) => artist.name),
          album: item.album.name,
          duration_ms: item.duration_ms,
          explicit: item.explicit,
          external_urls: item.external_urls,
          image_url: null // Default to null, album art will be loaded separately if needed
        };
        return queueItem;
      });
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
      error: 'Failed to get queue details' 
    }, { status: 500 });
  }
}
