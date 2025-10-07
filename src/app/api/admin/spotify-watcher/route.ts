import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { triggerPlaybackUpdate, triggerStatsUpdate } from '@/lib/pusher';
import { getAllRequests } from '@/lib/db';
import { getSpotifyConnectionStatus } from '@/lib/spotify-status';
import { shouldAttemptSpotifyCall, isSpotifyPermanentlyDisconnected } from '@/lib/spotify-connection-state';

// Store last known state to detect changes (excluding progress_ms which changes constantly)
let lastPlaybackState: any = null;
let lastQueueState: any = null;
let watcherInterval: NodeJS.Timeout | null = null;
let lastStatsUpdate = 0;
let lastQueueCheck = 0; // Track when we last checked the queue

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

// Spotify watcher function
const watchSpotifyChanges = async (queueInterval: number = 20000) => {
  try {
    // TODO: Multi-tenant refactor needed - this watcher should be per-user
    // For now, skip event status check as we can't determine userId in background task
    // The watcher will run for all users globally
    console.log('⚠️ Spotify watcher: Running in global mode (multi-tenant refactor needed)');

    // Don't try if permanently disconnected
    if (isSpotifyPermanentlyDisconnected()) {
      console.log('⏸️ Spotify watcher: Skipping check - permanently disconnected');
      return;
    }

    // Don't try if in backoff period
    if (!shouldAttemptSpotifyCall()) {
      console.log('⏸️ Spotify watcher: Skipping check - in backoff period');
      return;
    }

    console.log('🎵 Spotify watcher: Checking for changes...', new Date().toISOString());
    
    // Check if Spotify is connected using centralized status
    const isConnected = await getSpotifyConnectionStatus();
    
    let currentPlayback = null;
    let queue = null;
    const now = Date.now();
    const shouldCheckQueue = now - lastQueueCheck >= queueInterval;
    
    if (isConnected) {
      // Always get current playback (5s interval)
      // Only get queue if enough time has passed (20s interval)
      if (shouldCheckQueue) {
        console.log('🎵 Checking both playback AND queue (queue interval reached)');
        [currentPlayback, queue] = await Promise.all([
          spotifyService.getCurrentPlayback().catch(() => null),
          spotifyService.getQueue().catch(() => null)
        ]);
        lastQueueCheck = now;
      } else {
        console.log('🎵 Checking playback only (queue check skipped)');
        currentPlayback = await spotifyService.getCurrentPlayback().catch(() => null);
        // Keep using the last known queue state
        queue = lastQueueState ? { queue: lastQueueState } : null;
      }

      // Debug: Log current playback state
      console.log('🎵 Current playback state:', {
        is_playing: currentPlayback?.is_playing,
        track: currentPlayback?.item?.name,
        device: currentPlayback?.device?.name,
        hasPlayback: !!currentPlayback
      });

      // Check if anything meaningful changed (excluding progress_ms)
      const normalizedCurrentPlayback = normalizePlaybackForComparison(currentPlayback);
      const normalizedLastPlayback = normalizePlaybackForComparison(lastPlaybackState);
      
      const playbackChanged = JSON.stringify(normalizedCurrentPlayback) !== JSON.stringify(normalizedLastPlayback);
      const queueChanged = JSON.stringify(queue?.queue) !== JSON.stringify(lastQueueState);
      
      // Additional checks for critical state changes that should always trigger updates
      const criticalChanges = {
        isPlayingChanged: lastPlaybackState?.is_playing !== currentPlayback?.is_playing,
        trackChanged: lastPlaybackState?.item?.id !== currentPlayback?.item?.id,
        deviceChanged: lastPlaybackState?.device?.id !== currentPlayback?.device?.id,
        hasNewPlayback: !lastPlaybackState && currentPlayback,
        lostPlayback: lastPlaybackState && !currentPlayback
      };
      
      const hasCriticalChanges = Object.values(criticalChanges).some(Boolean);

      // Debug: Always log critical changes check
      console.log('🔍 Critical changes check:', {
        lastIsPlaying: lastPlaybackState?.is_playing,
        currentIsPlaying: currentPlayback?.is_playing,
        isPlayingChanged: criticalChanges.isPlayingChanged,
        hasCriticalChanges,
        criticalChanges
      });

      if (playbackChanged || queueChanged || hasCriticalChanges) {
        console.log('🎵 Spotify watcher: MEANINGFUL changes detected, triggering Pusher event');
        console.log('🔍 Playback changed:', playbackChanged);
        console.log('🔍 Queue changed:', queueChanged);
        console.log('🔍 Critical changes:', hasCriticalChanges);
        
        // Debug: Log what specifically changed
        if (playbackChanged || hasCriticalChanges) {
          console.log('🎵 Playback change details:');
          console.log('  - is_playing:', lastPlaybackState?.is_playing, '->', currentPlayback?.is_playing);
          console.log('  - track:', lastPlaybackState?.item?.name, '->', currentPlayback?.item?.name);
          console.log('  - device:', lastPlaybackState?.device?.name, '->', currentPlayback?.device?.name);
          console.log('  - critical changes:', criticalChanges);
        }
        
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

        // Format current track data properly
        const formattedCurrentTrack = currentPlayback?.item ? {
          name: currentPlayback.item.name,
          artists: currentPlayback.item.artists?.map((a: any) => a.name) || [],
          album: currentPlayback.item.album,
          duration_ms: currentPlayback.item.duration_ms,
          uri: currentPlayback.item.uri,
          id: currentPlayback.item.id
        } : null;

        // Trigger Pusher event with enhanced data
        await triggerPlaybackUpdate({
          current_track: formattedCurrentTrack,
          queue: enhancedQueue,
          is_playing: currentPlayback?.is_playing || false,
          progress_ms: currentPlayback?.progress_ms || 0,
          device: currentPlayback?.device || null,
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
