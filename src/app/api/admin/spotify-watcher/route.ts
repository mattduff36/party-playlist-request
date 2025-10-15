import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { triggerPlaybackUpdate, triggerStatsUpdate } from '@/lib/pusher';
import { getAllRequests } from '@/lib/db';

// Store last known state PER USER to detect changes (excluding progress_ms which changes constantly)
const lastPlaybackStates = new Map<string, any>(); // userId -> lastPlaybackState
const lastQueueStates = new Map<string, any>();    // userId -> lastQueueState
const lastQueueChecks = new Map<string, number>(); // userId -> timestamp
const lastStatsStates = new Map<string, any>();    // userId -> lastStatsState (for change detection)
let watcherInterval: NodeJS.Timeout | null = null;
let lastStatsUpdate = 0;

// Helper function to normalize playback state for comparison (exclude progress_ms)
const normalizePlaybackForComparison = (playback: any) => {
  if (!playback) return null;
  const { progress_ms, ...normalized } = playback;
  return {
    ...normalized,
    // Include all important playback state properties
    is_playing: playback.is_playing,
    device: playback.device ? {
      id: playback.device.id,
      name: playback.device.name,
      type: playback.device.type,
      volume_percent: playback.device.volume_percent
    } : null,
    item: playback.item ? {
      // Include all track properties that matter for change detection
      id: playback.item.id,
      name: playback.item.name,
      uri: playback.item.uri,
      duration_ms: playback.item.duration_ms,
      artists: playback.item.artists?.map((a: any) => ({
        id: a.id,
        name: a.name
      })) || [],
      album: playback.item.album ? {
        id: playback.item.album.id,
        name: playback.item.album.name,
        images: playback.item.album.images || []
      } : null
    } : null
  };
};

// Spotify watcher function - now properly multi-tenant
const watchSpotifyChanges = async (queueInterval: number = 20000) => {
  try {
    console.log('🎵 Spotify watcher: Starting multi-tenant check...', new Date().toISOString());
    
    // Get all users with valid Spotify connections
    const { sql } = await import('@/lib/db/neon-client');
    const usersWithSpotify = await sql`
      SELECT u.id as user_id, u.username 
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM spotify_auth sa 
        WHERE sa.user_id = u.id 
        AND sa.access_token IS NOT NULL 
        AND sa.refresh_token IS NOT NULL
      )
      LIMIT 10
    `;
    
    if (usersWithSpotify.length === 0) {
      console.log('⏸️ No users with Spotify connections found');
      return;
    }
    
    console.log(`🎵 Checking Spotify for ${usersWithSpotify.length} user(s)`);
    
    // Check each user's Spotify separately
    for (const { user_id, username } of usersWithSpotify) {
      await watchSingleUserSpotify(user_id, username, queueInterval);
    }

  } catch (error) {
    console.error('🎵 Spotify watcher error:', error);
  }
};

// Watch a single user's Spotify playback
const watchSingleUserSpotify = async (userId: string, username: string, queueInterval: number) => {
  try {
    console.log(`🎵 [${username}] Checking Spotify playback...`);
    
    // Check if THIS USER's Spotify is connected (using userId!)
    const isConnected = await spotifyService.isConnected(userId);
    
    if (!isConnected) {
      console.log(`⏸️ [${username}] Not connected, skipping`);
      return;
    }
    
    let currentPlayback = null;
    let queue = null;
    const now = Date.now();
    
    // Get THIS USER's last state (PER-USER STATE TRACKING!)
    const userLastPlayback = lastPlaybackStates.get(userId);
    const userLastQueue = lastQueueStates.get(userId);
    const userLastQueueCheck = lastQueueChecks.get(userId) || 0;
    
    const shouldCheckQueue = now - userLastQueueCheck >= queueInterval;
    
    try {
      // First, always get current playback
      currentPlayback = await spotifyService.getCurrentPlayback(userId).catch(() => null);
      
      // Check if track changed - if so, ALWAYS fetch fresh queue regardless of interval
      const trackChanged = userLastPlayback?.item?.id !== currentPlayback?.item?.id;
      
      if (shouldCheckQueue || trackChanged) {
        if (trackChanged) {
          console.log(`🎵 [${username}] Track changed! Fetching fresh queue...`);
          
          // Auto-mark the new playing track as "played" if it matches an approved request
          if (currentPlayback?.item?.uri) {
            try {
              const { sql } = await import('@/lib/db/neon-client');
              
              // SECURITY: Find the oldest approved request matching this track URI for THIS user only (multi-tenant isolation)
              const matchingRequest = await sql`
                UPDATE requests
                SET status = 'played',
                    played_at = NOW()
                WHERE id = (
                  SELECT id FROM requests
                  WHERE track_uri = ${currentPlayback.item.uri}
                    AND status = 'approved'
                    AND user_id = ${userId}
                  ORDER BY created_at ASC
                  LIMIT 1
                )
                RETURNING id, track_name, artist_name, track_uri
              `;
              
              if (matchingRequest.length > 0) {
                const req = matchingRequest[0];
                console.log(`✅ [${username}] Auto-marked request as played: "${req.track_name}" by ${req.artist_name}`);
                
                // Broadcast the status change via Pusher
                try {
                  const { triggerEvent, getAdminChannel, EVENTS } = await import('@/lib/pusher');
                  await triggerEvent(getAdminChannel(userId), EVENTS.STATS_UPDATE, {
                    message: `Song "${req.track_name}" marked as played`,
                    userId
                  });
                } catch (pusherError) {
                  console.error(`❌ [${username}] Failed to send auto-mark Pusher event:`, pusherError);
                }
              }
            } catch (markError) {
              console.error(`❌ [${username}] Error auto-marking song as played:`, markError);
              // Don't fail the watcher if auto-mark fails
            }
          }
        } else {
          console.log(`🎵 [${username}] Queue interval reached, checking queue`);
        }
        queue = await spotifyService.getQueue(userId).catch(() => null);
        lastQueueChecks.set(userId, now);
      } else {
        console.log(`🎵 [${username}] Checking playback only (reusing queue)`);
        queue = userLastQueue ? { queue: userLastQueue } : null;
      }
    } catch (error) {
      console.error(`❌ [${username}] Error fetching playback:`, error);
      return;
    }

    // Log current playback state for monitoring
    console.log(`🎵 [${username}] Current playback:`, {
      is_playing: currentPlayback?.is_playing,
      track: currentPlayback?.item?.name,
      device: currentPlayback?.device?.name,
      hasPlayback: !!currentPlayback
    });

    // Check if anything meaningful changed (compare to THIS USER's last state!)
    const normalizedCurrentPlayback = normalizePlaybackForComparison(currentPlayback);
    const normalizedLastPlayback = normalizePlaybackForComparison(userLastPlayback);
    
    const playbackChanged = JSON.stringify(normalizedCurrentPlayback) !== JSON.stringify(normalizedLastPlayback);
    const queueChanged = JSON.stringify(queue?.queue) !== JSON.stringify(userLastQueue);
    
    // Critical state changes
    const criticalChanges = {
      isPlayingChanged: userLastPlayback?.is_playing !== currentPlayback?.is_playing,
      trackChanged: userLastPlayback?.item?.id !== currentPlayback?.item?.id,
      deviceChanged: userLastPlayback?.device?.id !== currentPlayback?.device?.id,
      hasNewPlayback: !userLastPlayback && currentPlayback,
      lostPlayback: userLastPlayback && !currentPlayback
    };
    
    const hasCriticalChanges = Object.values(criticalChanges).some(Boolean);

    if (playbackChanged || queueChanged || hasCriticalChanges) {
      console.log(`🎵 [${username}] MEANINGFUL changes detected!`);
      
      // OPTIMIZED: Get ONLY approved requests with single targeted query
      const { getRequestsByStatus } = await import('@/lib/db');
      const userApprovedRequests = await getRequestsByStatus('approved', 100, 0, userId);

      // Enhance queue items with requester information
      const enhancedQueue = (queue?.queue || []).map((track: any) => {
        const matchingRequest = userApprovedRequests.find(req => req.track_uri === track.uri);
        return {
          ...track,
          requester_nickname: matchingRequest?.requester_nickname || null
        };
      });

      // Format current track data
      const formattedCurrentTrack = currentPlayback?.item ? {
        name: currentPlayback.item.name,
        artists: currentPlayback.item.artists?.map((a: any) => a.name) || [],
        album: currentPlayback.item.album,
        duration_ms: currentPlayback.item.duration_ms,
        uri: currentPlayback.item.uri,
        id: currentPlayback.item.id
      } : null;

      // ✅ Trigger Pusher update for THIS USER ONLY
      try {
        console.log(`📡 [${username}] Sending playback update to Pusher`);
        await triggerPlaybackUpdate({
          current_track: formattedCurrentTrack,
          queue: enhancedQueue,
          is_playing: currentPlayback?.is_playing || false,
          progress_ms: currentPlayback?.progress_ms || 0,
          device: currentPlayback?.device || null,
          timestamp: Date.now(),
          userId: userId
        });
      } catch (pusherError) {
        console.error(`❌ [${username}] Failed to trigger playback update:`, pusherError);
      }

      // Update stored state FOR THIS USER
      lastPlaybackStates.set(userId, currentPlayback);
      lastQueueStates.set(userId, queue?.queue);
    } else {
      console.log(`🎵 [${username}] No meaningful changes`);
    }

    // Update stats only every 30 seconds AND only if values changed
    if (now - lastStatsUpdate > 30000) {
      console.log(`📊 [${username}] Calculating stats (30s interval)`);
      const { getAllRequests: getUserRequests } = await import('@/lib/db');
      // OPTIMIZED: Get all requests with single query (still needed for stats)
      const allRequests = await getUserRequests(1000, 0, userId); // Multi-tenant: Pass userId
      
      const stats = {
        total_requests: allRequests.length,
        pending_requests: allRequests.filter(r => r.status === 'pending').length,
        approved_requests: allRequests.filter(r => r.status === 'approved').length,
        rejected_requests: allRequests.filter(r => r.status === 'rejected').length,
        played_requests: allRequests.filter(r => r.status === 'played').length,
        unique_requesters: new Set(allRequests.map(r => r.requester_nickname || 'Anonymous')).size,
        spotify_connected: isConnected
      };

      // OPTIMIZATION: Only trigger update if stats actually changed
      const lastStats = lastStatsStates.get(userId);
      const statsChanged = !lastStats || JSON.stringify(lastStats) !== JSON.stringify(stats);
      
      if (statsChanged) {
        // Trigger stats update for THIS USER
        try {
          console.log(`📡 [${username}] Stats changed - sending update to Pusher`);
          await triggerStatsUpdate({...stats, userId});
          lastStatsStates.set(userId, stats);
        } catch (pusherError) {
          console.error(`❌ [${username}] Failed to trigger stats update:`, pusherError);
        }
      } else {
        console.log(`📊 [${username}] Stats unchanged - skipping Pusher event`);
      }
      
      lastStatsUpdate = now;
    }

  } catch (error) {
    console.error('🎵 Spotify watcher error:', error);
  }
};

// Start watcher endpoint
export async function POST(req: NextRequest) {
  try {
    // Allow system startup token for automatic watcher initialization
    const authHeader = req.headers.get('Authorization');
    const isSystemStartup = authHeader?.includes('startup-system-token') || 
                           authHeader?.includes(process.env.SYSTEM_STARTUP_TOKEN || '');
    
    if (!isSystemStartup) {
      // Authenticate and get user info
      const auth = requireAuth(req);
      if (!auth.authenticated || !auth.user) {
        return auth.response!;
      }
    } else {
      console.log('🔧 System startup: Starting Spotify watcher automatically');
    }
    
    const body = await req.json();
    const { action, interval = 5000, queueInterval = 20000 } = body; // Default: 5s playback, 20s queue

    if (action === 'start') {
      if (watcherInterval) {
        clearInterval(watcherInterval);
      }

      console.log(`🎵 Starting Spotify watcher with ${interval}ms playback interval and ${queueInterval}ms queue interval`);
      
      // Start immediate check
      await watchSpotifyChanges(queueInterval);
      
      // Set up interval for playback checks (queue will be checked based on queueInterval)
      watcherInterval = setInterval(() => watchSpotifyChanges(queueInterval), interval);

      return NextResponse.json({
        success: true,
        message: 'Spotify watcher started',
        interval,
        queueInterval
      });
    }

    if (action === 'stop') {
      if (watcherInterval) {
        clearInterval(watcherInterval);
        watcherInterval = null;
        console.log('🎵 Spotify watcher stopped');
      }

      return NextResponse.json({
        success: true,
        message: 'Spotify watcher stopped'
      });
    }

    if (action === 'status') {
      return NextResponse.json({
        running: !!watcherInterval,
        lastUpdate: Date.now()
      });
    }

    if (action === 'check') {
      // Trigger an immediate check for changes
      console.log('🔄 Manual Spotify watcher check triggered');
      await watchSpotifyChanges();
      return NextResponse.json({
        success: true,
        message: 'Manual check completed'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Spotify watcher endpoint error:', error);
    return NextResponse.json({ 
      error: 'Failed to manage Spotify watcher' 
    }, { status: 500 });
  }
}

// Get watcher status
export async function GET(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
      return NextResponse.json({
        running: !!watcherInterval,
        lastUpdate: Date.now(),
        interval: watcherInterval ? 2000 : null
      });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get watcher status' 
    }, { status: 500 });
  }
}
