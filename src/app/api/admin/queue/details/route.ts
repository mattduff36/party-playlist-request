import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🔍 [${requestId}] Queue details endpoint called at ${new Date().toISOString()}`);
  
  try {
    // Verify admin authentication first
    const authStart = Date.now();
    await authService.requireAdminAuth(req);
    console.log(`✅ [${requestId}] Admin auth verified (${Date.now() - authStart}ms)`);
    
    // Check if we have Spotify tokens first
    console.log(`🔍 [${requestId}] Checking Spotify token availability...`);
    const tokenCheckStart = Date.now();
    let hasTokens = false;
    try {
      hasTokens = await spotifyService.isConnected();
      console.log(`🔍 [${requestId}] Token check result: ${hasTokens} (${Date.now() - tokenCheckStart}ms)`);
    } catch (tokenError) {
      console.log(`❌ [${requestId}] Token check failed: ${(tokenError as Error).message} (${Date.now() - tokenCheckStart}ms)`);
    }
    
    if (!hasTokens) {
      console.log(`⚠️ [${requestId}] No Spotify tokens available, returning empty response`);
      return NextResponse.json({
        current_track: null,
        queue: [],
        device: null,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'off',
        spotify_connected: false,
        debug: {
          request_id: requestId,
          has_tokens: false,
          total_duration: Date.now() - startTime
        }
      });
    }
    
    // Get both current playback and queue - let Spotify API calls handle their own auth
    console.log(`🎵 [${requestId}] Fetching Spotify playback and queue data...`);
    const spotifyCallStart = Date.now();
    
    let playbackState = null;
    let queueData = null;
    let spotifyConnected = true; // Assume connected, let API calls determine if not
    let spotifyErrors = [];
    
    // Try getCurrentPlayback first
    console.log(`🎵 [${requestId}] Calling getCurrentPlayback()...`);
    const playbackStart = Date.now();
    try {
      playbackState = await spotifyService.getCurrentPlayback();
      console.log(`✅ [${requestId}] getCurrentPlayback() successful (${Date.now() - playbackStart}ms)`);
      if (playbackState) {
        console.log(`🎵 [${requestId}] Playback state: ${playbackState.is_playing ? 'playing' : 'paused'}, track: ${playbackState.item?.name || 'unknown'}`);
      } else {
        console.log(`🎵 [${requestId}] No active playback`);
      }
    } catch (playbackError) {
      const errorMessage = (playbackError as Error).message;
      console.log(`❌ [${requestId}] getCurrentPlayback() failed: ${errorMessage} (${Date.now() - playbackStart}ms)`);
      spotifyErrors.push(`getCurrentPlayback: ${errorMessage}`);
      
      if (errorMessage.includes('token') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        spotifyConnected = false;
        console.log(`🔄 [${requestId}] Auth error in getCurrentPlayback, marking as disconnected`);
      }
    }
    
    // Try getQueue second
    console.log(`🎵 [${requestId}] Calling getQueue()...`);
    const queueStart = Date.now();
    try {
      queueData = await spotifyService.getQueue();
      console.log(`✅ [${requestId}] getQueue() successful (${Date.now() - queueStart}ms)`);
      if (queueData?.queue) {
        console.log(`🎵 [${requestId}] Queue has ${queueData.queue.length} items`);
      } else {
        console.log(`🎵 [${requestId}] No queue data`);
      }
    } catch (queueError) {
      const errorMessage = (queueError as Error).message;
      console.log(`❌ [${requestId}] getQueue() failed: ${errorMessage} (${Date.now() - queueStart}ms)`);
      spotifyErrors.push(`getQueue: ${errorMessage}`);
      
      if (errorMessage.includes('token') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        spotifyConnected = false;
        console.log(`🔄 [${requestId}] Auth error in getQueue, marking as disconnected`);
      }
    }
    
    console.log(`🎵 [${requestId}] Spotify API calls completed (${Date.now() - spotifyCallStart}ms total)`);
    if (spotifyErrors.length > 0) {
      console.log(`⚠️ [${requestId}] Spotify errors encountered: ${spotifyErrors.join(', ')}`);
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
    
    console.log(`🎯 [${requestId}] Queue details endpoint completed (${Date.now() - startTime}ms total)`);
    
    return NextResponse.json({
      current_track: currentTrack,
      queue: queueItems,
      device: playbackState?.device || null,
      is_playing: playbackState?.is_playing || false,
      shuffle_state: playbackState?.shuffle_state || false,
      repeat_state: playbackState?.repeat_state || 'off',
      spotify_connected: spotifyConnected,
      debug: {
        request_id: requestId,
        has_tokens: hasTokens,
        spotify_errors: spotifyErrors,
        total_duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
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
