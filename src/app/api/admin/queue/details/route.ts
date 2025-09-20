import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';
import { getSpotifyConnectionStatus } from '@/lib/spotify-status';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🔍 [${requestId}] Queue details endpoint called at ${new Date().toISOString()}`);
  
  try {
    // Verify admin authentication first
    const authStart = Date.now();
    await authService.requireAdminAuth(req);
    console.log(`✅ [${requestId}] Admin auth verified (${Date.now() - authStart}ms)`);
    
    // Check if we have valid Spotify connection using centralized status
    console.log(`🔍 [${requestId}] Checking Spotify connection status...`);
    const statusCheckStart = Date.now();
    let hasValidConnection = false;
    try {
      hasValidConnection = await getSpotifyConnectionStatus();
      console.log(`🔍 [${requestId}] Centralized status result: ${hasValidConnection} (${Date.now() - statusCheckStart}ms)`);
    } catch (statusError) {
      console.log(`❌ [${requestId}] Centralized status check failed: ${(statusError as Error).message} (${Date.now() - statusCheckStart}ms)`);
    }
    
    // TEMPORARY DEBUG: Also check the old way to compare
    try {
      const directCheck = await spotifyService.isConnectedAndValid();
      console.log(`🔍 [${requestId}] Direct isConnectedAndValid result: ${directCheck}`);
      
      if (hasValidConnection !== directCheck) {
        console.log(`⚠️ [${requestId}] MISMATCH! Centralized: ${hasValidConnection}, Direct: ${directCheck}`);
      }
    } catch (directError) {
      console.log(`❌ [${requestId}] Direct check failed: ${(directError as Error).message}`);
    }
    
    // TEMPORARY FIX: Always try Spotify APIs since they're working in the logs
    // TODO: Fix centralized status system later
    console.log(`🔍 [${requestId}] Attempting Spotify API calls (bypassing centralized check temporarily)`);
    
    // Get both current playback and queue - let Spotify API calls handle their own auth
    console.log(`🎵 [${requestId}] Fetching Spotify playback and queue data...`);
    const spotifyCallStart = Date.now();
    
    let playbackState = null;
    let queueData = null;
    let spotifyErrors = [];
    
    // TEMPORARY: Determine connection based on successful API calls
    let spotifyConnected = true; // Will be set to false if API calls fail
    
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
    
    // Process current track with album art from existing data
    let currentTrack = null;
    if (playbackState?.item) {
      // Use album art from the playback response instead of making additional API calls
      const albumImages = playbackState.item.album?.images || [];
      const imageUrl = albumImages.length > 0 ? 
        (albumImages[1]?.url || albumImages[0]?.url) : null;
      
      currentTrack = {
        id: playbackState.item.id,
        uri: playbackState.item.uri,
        name: playbackState.item.name,
        artists: playbackState.item.artists.map((artist: any) => artist.name),
        album: playbackState.item.album.name,
        duration_ms: playbackState.item.duration_ms,
        explicit: playbackState.item.explicit,
        external_urls: playbackState.item.external_urls,
        image_url: imageUrl,
        progress_ms: playbackState.progress_ms,
        is_playing: playbackState.is_playing
      };
    }
    
    // Process queue items with album art from existing data
    let queueItems = [];
    if (queueData?.queue) {
      queueItems = queueData.queue.slice(0, 10).map((item: any) => {
        // Use album art from the queue response instead of making additional API calls
        const albumImages = item.album?.images || [];
        const imageUrl = albumImages.length > 0 ? 
          (albumImages[1]?.url || albumImages[0]?.url) : null;
        
        return {
          id: item.id,
          uri: item.uri,
          name: item.name,
          artists: item.artists.map((artist: any) => artist.name),
          album: item.album.name,
          duration_ms: item.duration_ms,
          explicit: item.explicit,
          external_urls: item.external_urls,
          image_url: imageUrl
        };
      });
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
        has_valid_connection: hasValidConnection,
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
