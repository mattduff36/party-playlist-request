import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';

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
    let spotifyConnected = false;
    try {
      spotifyConnected = await spotifyService.isConnectedAndValid(userId);
      console.log(`🔍 [${requestId}] User ${userId} Spotify connection: ${spotifyConnected} (${Date.now() - statusCheckStart}ms)`);
    } catch (statusError) {
      console.log(`❌ [${requestId}] Spotify status check failed for user ${userId}: ${(statusError as Error).message} (${Date.now() - statusCheckStart}ms)`);
      spotifyConnected = false;
    }
    
    // If not connected, return early with disconnected status
    if (!spotifyConnected) {
      console.log(`⚠️ [${requestId}] User ${userId} not connected to Spotify, returning early`);
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
          has_valid_connection: false,
          spotify_errors: ['Not connected to Spotify'],
          total_duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // User is connected, attempt Spotify API calls
    console.log(`🎵 [${requestId}] Fetching Spotify playback and queue data...`);
    const spotifyCallStart = Date.now();
    
    let playbackState = null;
    let queueData = null;
    const spotifyErrors: string[] = [];
    
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
      spotify_connected: spotifyConnected, // Now always true here since we return early if false
      debug: {
        request_id: requestId,
        has_valid_connection: spotifyConnected,
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
