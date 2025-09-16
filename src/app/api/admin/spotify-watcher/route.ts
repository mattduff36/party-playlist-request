import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';
import { triggerPlaybackUpdate, triggerStatsUpdate } from '@/lib/pusher';
import { getAllRequests } from '@/lib/db';

// Store last known state to detect changes
let lastPlaybackState: any = null;
let lastQueueState: any = null;
let watcherInterval: NodeJS.Timeout | null = null;

// Spotify watcher function
const watchSpotifyChanges = async () => {
  try {
    console.log('🎵 Spotify watcher: Checking for changes...');
    
    // Check if Spotify is connected
    const isConnected = await spotifyService.isConnected();
    if (!isConnected) {
      console.log('🎵 Spotify watcher: Not connected, skipping...');
      return;
    }

    // Get current playback and queue
    const [currentPlayback, queue] = await Promise.all([
      spotifyService.getCurrentPlayback().catch(() => null),
      spotifyService.getQueue().catch(() => null)
    ]);

    // Create current state snapshot
    const currentState = {
      playback: currentPlayback,
      queue: queue?.queue || []
    };

    // Check if anything changed
    const playbackChanged = JSON.stringify(currentPlayback) !== JSON.stringify(lastPlaybackState);
    const queueChanged = JSON.stringify(queue?.queue) !== JSON.stringify(lastQueueState);

    if (playbackChanged || queueChanged) {
      console.log('🎵 Spotify watcher: Changes detected, triggering Pusher event');
      
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
    }

    // Also update stats periodically
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

  } catch (error) {
    console.error('🎵 Spotify watcher error:', error);
  }
};

// Start watcher endpoint
export async function POST(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const body = await req.json();
    const { action, interval = 2000 } = body;

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
      interval: watcherInterval ? 2000 : null
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get watcher status' 
    }, { status: 500 });
  }
}
