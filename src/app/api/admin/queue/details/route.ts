import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { getSpotifyConnectionStatus } from '@/lib/spotify-status';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🔍 [${requestId}] Queue details endpoint called at ${new Date().toISOString()}`);
  
  try {
    // Authenticate and get user info
    const authStart = Date.now();
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`✅ [${requestId}] User ${auth.user.username} (${userId}) auth verified (${Date.now() - authStart}ms)`);
    
    // Check if THIS USER has valid Spotify connection (MULTI-TENANT!)
    console.log(`🔍 [${requestId}] Checking Spotify connection for user ${userId}...`);
    const statusCheckStart = Date.now();
    let hasValidConnection = false;
    try {
      hasValidConnection = await spotifyService.isConnectedAndValid(userId);
      console.log(`🔍 [${requestId}] User ${userId} Spotify connection: ${hasValidConnection} (${Date.now() - statusCheckStart}ms)`);
    } catch (statusError) {
      console.log(`❌ [${requestId}] Spotify status check failed for user ${userId}: ${(statusError as Error).message} (${Date.now() - statusCheckStart}ms)`);
    }
    
    // Always attempt Spotify API calls (they handle their own auth/tokens)
    console.log(`🎵 [${requestId}] Fetching Spotify playback and queue data...`);
    const spotifyCallStart = Date.now();
    
    let playbackState = null;
    let queueData = null;
    let spotifyErrors = [];
    
    // Determine connection based on successful API calls
    let spotifyConnected = true; // Will be set to false if API calls fail
    
    // Try getCurrentPlayback first (MULTI-TENANT: pass userId!)
    console.log(`🎵 [${requestId}] Calling getCurrentPlayback(${userId})...`);
    const playbackStart = Date.now();
    try {
      playbackState = await spotifyService.getCurrentPlayback(userId);
      console.log(`✅ [${requestId}] getCurrentPlayback() successful for user ${userId} (${Date.now() - playbackStart}ms)`);
      if (playbackState) {
        console.log(`🎵 [${requestId}] Playback state: ${playbackState.is_playing ? 'playing' : 'paused'}, track: ${playbackState.item?.name || 'unknown'}`);
      } else {
        console.log(`🎵 [${requestId}] No active playback for user ${userId}`);
      }
    } catch (playbackError) {
      const errorMessage = (playbackError as Error).message;
      console.log(`❌ [${requestId}] getCurrentPlayback() failed for user ${userId}: ${errorMessage} (${Date.now() - playbackStart}ms)`);
      spotifyErrors.push(`getCurrentPlayback: ${errorMessage}`);
      
      if (errorMessage.includes('token') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        spotifyConnected = false;
        console.log(`🔄 [${requestId}] Auth error in getCurrentPlayback, marking as disconnected`);
      }
    }
    
    // Try getQueue second (MULTI-TENANT: pass userId!)
    console.log(`🎵 [${requestId}] Calling getQueue(${userId})...`);
    const queueStart = Date.now();
    try {
      queueData = await spotifyService.getQueue(userId);
      console.log(`✅ [${requestId}] getQueue() successful for user ${userId} (${Date.now() - queueStart}ms)`);
      if (queueData?.queue) {
        console.log(`🎵 [${requestId}] Queue has ${queueData.queue.length} items for user ${userId}`);
      } else {
        console.log(`🎵 [${requestId}] No queue data for user ${userId}`);
      }
    } catch (queueError) {
      const errorMessage = (queueError as Error).message;
      console.log(`❌ [${requestId}] getQueue() failed for user ${userId}: ${errorMessage} (${Date.now() - queueStart}ms)`);
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
