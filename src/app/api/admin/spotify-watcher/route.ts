import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';
import { triggerPlaybackUpdate, triggerStatsUpdate } from '@/lib/pusher';
import { getAllRequests } from '@/lib/db';
import { getSpotifyConnectionStatus } from '@/lib/spotify-status';

// Store last known state to detect changes (excluding progress_ms which changes constantly)
let lastPlaybackState: any = null;
let lastQueueState: any = null;
let watcherInterval: NodeJS.Timeout | null = null;
let lastStatsUpdate = 0;

// Helper function to normalize playback state for comparison (exclude progress_ms)
const normalizePlaybackForComparison = (playback: any) => {
  if (!playback) return null;
  const { progress_ms, ...normalized } = playback;
  return {
    ...normalized,
    item: playback.item ? {
      ...playback.item,
      // Only include stable track properties
      id: playback.item.id,
      name: playback.item.name,
      uri: playback.item.uri,
      duration_ms: playback.item.duration_ms
    } : null
  };
};

// Spotify watcher function
const watchSpotifyChanges = async () => {
  try {
    console.log('🎵 Spotify watcher: Checking for changes...');
    
    // Check if Spotify is connected using centralized status
    const isConnected = await getSpotifyConnectionStatus();
    
    let currentPlayback = null;
    let queue = null;
    
    if (isConnected) {
      // Get current playback and queue only if connected
      [currentPlayback, queue] = await Promise.all([
        spotifyService.getCurrentPlayback().catch(() => null),
        spotifyService.getQueue().catch(() => null)
      ]);

      // Check if anything meaningful changed (excluding progress_ms)
      const normalizedCurrentPlayback = normalizePlaybackForComparison(currentPlayback);
      const normalizedLastPlayback = normalizePlaybackForComparison(lastPlaybackState);
      
      const playbackChanged = JSON.stringify(normalizedCurrentPlayback) !== JSON.stringify(normalizedLastPlayback);
      const queueChanged = JSON.stringify(queue?.queue) !== JSON.stringify(lastQueueState);

      if (playbackChanged || queueChanged) {
        console.log('🎵 Spotify watcher: MEANINGFUL changes detected, triggering Pusher event');
        console.log('🔍 Playback changed:', playbackChanged);
        console.log('🔍 Queue changed:', queueChanged);
        
        // Get approved requests to match with queue items
        const approvedRequests = await getAllRequests().then(requests => 
          requests.filter(r => r.status === 'approved')
        );

        // Enhance queue items with requester information
        const enhancedQueue = (queue?.queue || []).map((track: any) => {
          const matchingRequest = approvedRequests.find(req => req.track_uri === track.uri);
          return {
            ...track,
            requester_nickname: matchingRequest?.requester_nickname || null
          };
        });

        // Trigger Pusher event with enhanced data
        await triggerPlaybackUpdate({
          current_track: currentPlayback?.item || null,
          queue: enhancedQueue,
          is_playing: currentPlayback?.is_playing || false,
          progress_ms: currentPlayback?.progress_ms || 0,
          timestamp: Date.now()
        });

        // Update stored state
        lastPlaybackState = currentPlayback;
        lastQueueState = queue?.queue;
      } else {
        console.log('🎵 Spotify watcher: No meaningful changes, skipping Pusher event');
      }
    } else {
      console.log('🎵 Spotify watcher: Not connected or tokens invalid, skipping playback checks');
    }

    // Update stats only every 30 seconds (not every 2 seconds!)
    const now = Date.now();
    if (now - lastStatsUpdate > 30000) {
      console.log('📊 Spotify watcher: Updating stats (30s interval)');
      const requests = await getAllRequests();
      const stats = {
        total_requests: requests.length,
        pending_requests: requests.filter(r => r.status === 'pending').length,
        approved_requests: requests.filter(r => r.status === 'approved').length,
        rejected_requests: requests.filter(r => r.status === 'rejected').length,
        played_requests: requests.filter(r => r.status === 'played').length,
        unique_requesters: new Set(requests.map(r => r.requester_nickname || 'Anonymous')).size,
        spotify_connected: isConnected
      };

      await triggerStatsUpdate(stats);
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
      await authService.requireAdminAuth(req);
    } else {
      console.log('🔧 System startup: Starting Spotify watcher automatically');
    }
    
    const body = await req.json();
    const { action, interval = 5000 } = body; // Default to 5 seconds instead of 2

    if (action === 'start') {
      if (watcherInterval) {
        clearInterval(watcherInterval);
      }

      console.log(`🎵 Starting Spotify watcher with ${interval}ms interval`);
      
      // Start immediate check
      await watchSpotifyChanges();
      
      // Set up interval
      watcherInterval = setInterval(watchSpotifyChanges, interval);

      return NextResponse.json({
        success: true,
        message: 'Spotify watcher started',
        interval
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
    await authService.requireAdminAuth(req);
    
      return NextResponse.json({
        running: !!watcherInterval,
        lastUpdate: Date.now(),
        interval: watcherInterval ? 5000 : null
      });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get watcher status' 
    }, { status: 500 });
  }
}
