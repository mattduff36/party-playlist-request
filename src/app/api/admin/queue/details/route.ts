import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { getTrackAlbumImageUrl } from '@/lib/spotify-album-art';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapSpotifyTrackToCurrent(
  item: any,
  extras?: { progress_ms?: number; is_playing?: boolean }
) {
  if (!item) return null;

  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    artists: (item.artists || []).map((artist: any) =>
      typeof artist === 'string' ? artist : artist.name
    ),
    album: item.album?.name || item.album || '',
    duration_ms: item.duration_ms,
    explicit: item.explicit,
    external_urls: item.external_urls,
    image_url: getTrackAlbumImageUrl(item) || null,
    progress_ms: extras?.progress_ms,
    is_playing: extras?.is_playing,
  };
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🔍 [${requestId}] Queue details endpoint called at ${new Date().toISOString()}`);

  try {
    const authStart = Date.now();
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(
      `✅ [${requestId}] User ${auth.user.username} (${userId}) auth verified (${Date.now() - authStart}ms)`
    );

    console.log(`🔍 [${requestId}] Checking Spotify connection for user ${userId}...`);
    const statusCheckStart = Date.now();
    let spotifyConnected = false;
    try {
      spotifyConnected = await spotifyService.isConnectedAndValid(userId);
      console.log(
        `🔍 [${requestId}] User ${userId} Spotify connection: ${spotifyConnected} (${Date.now() - statusCheckStart}ms)`
      );
    } catch (statusError) {
      console.log(
        `❌ [${requestId}] Spotify status check failed for user ${userId}: ${(statusError as Error).message} (${Date.now() - statusCheckStart}ms)`
      );
      spotifyConnected = false;
    }

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
        playback_pending: false,
        debug: {
          request_id: requestId,
          has_valid_connection: false,
          spotify_errors: ['Not connected to Spotify'],
          total_duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    }

    console.log(`🎵 [${requestId}] Fetching Spotify playback and queue data...`);
    const spotifyCallStart = Date.now();

    let playbackState: any = null;
    let queueData: any = null;
    const spotifyErrors: string[] = [];

    console.log(`🎵 [${requestId}] Calling getCurrentPlayback(${userId})...`);
    const playbackStart = Date.now();
    try {
      playbackState = await spotifyService.getCurrentPlayback(userId);
      console.log(
        `✅ [${requestId}] getCurrentPlayback() successful for user ${userId} (${Date.now() - playbackStart}ms)`
      );
      if (playbackState) {
        console.log(
          `🎵 [${requestId}] Playback state: ${playbackState.is_playing ? 'playing' : 'paused'}, track: ${playbackState.item?.name || 'unknown'}`
        );
      } else {
        console.log(`🎵 [${requestId}] No active playback for user ${userId}`);
      }
    } catch (playbackError) {
      const errorMessage = (playbackError as Error).message;
      console.log(
        `❌ [${requestId}] getCurrentPlayback() failed for user ${userId}: ${errorMessage} (${Date.now() - playbackStart}ms)`
      );
      spotifyErrors.push(`getCurrentPlayback: ${errorMessage}`);
    }

    // Spotify often returns 204/null briefly while music is still audible — retry once
    if (!playbackState?.item) {
      await sleep(400);
      try {
        const retryPlayback = await spotifyService.getCurrentPlayback(userId);
        if (retryPlayback?.item) {
          playbackState = retryPlayback;
          console.log(
            `🎵 [${requestId}] getCurrentPlayback() retry recovered track: ${retryPlayback.item.name}`
          );
        }
      } catch (retryError) {
        spotifyErrors.push(
          `getCurrentPlayback retry: ${(retryError as Error).message}`
        );
      }
    }

    console.log(`🎵 [${requestId}] Calling getQueue(${userId})...`);
    const queueStart = Date.now();
    try {
      queueData = await spotifyService.getQueue(userId);
      console.log(
        `✅ [${requestId}] getQueue() successful for user ${userId} (${Date.now() - queueStart}ms)`
      );
      if (queueData?.queue) {
        console.log(
          `🎵 [${requestId}] Queue has ${queueData.queue.length} items for user ${userId}`
        );
      } else {
        console.log(`🎵 [${requestId}] No queue data for user ${userId}`);
      }
    } catch (queueError) {
      const errorMessage = (queueError as Error).message;
      console.log(
        `❌ [${requestId}] getQueue() failed for user ${userId}: ${errorMessage} (${Date.now() - queueStart}ms)`
      );
      spotifyErrors.push(`getQueue: ${errorMessage}`);
    }

    console.log(
      `🎵 [${requestId}] Spotify API calls completed (${Date.now() - spotifyCallStart}ms total)`
    );
    if (spotifyErrors.length > 0) {
      console.log(
        `⚠️ [${requestId}] Spotify errors encountered: ${spotifyErrors.join(', ')}`
      );
    }

    let currentTrack = mapSpotifyTrackToCurrent(playbackState?.item, {
      progress_ms: playbackState?.progress_ms,
      is_playing: playbackState?.is_playing,
    });

    // Fallback: /me/player/queue often has currently_playing when /me/player is 204
    if (!currentTrack && queueData?.currently_playing) {
      currentTrack = mapSpotifyTrackToCurrent(queueData.currently_playing, {
        is_playing: Boolean(playbackState?.is_playing),
      });
      console.log(
        `🎵 [${requestId}] Using queue.currently_playing fallback: ${currentTrack?.name}`
      );
    }

    let queueItems: any[] = [];
    if (queueData?.queue) {
      queueItems = queueData.queue.slice(0, 10).map((item: any) => {
        return {
          id: item.id,
          uri: item.uri,
          name: item.name,
          artists: item.artists.map((artist: any) => artist.name),
          album: item.album.name,
          duration_ms: item.duration_ms,
          explicit: item.explicit,
          external_urls: item.external_urls,
          image_url: getTrackAlbumImageUrl(item) || null,
        };
      });
    }

    // Best-effort device when player payload was empty.
    // Skip when Spotify already rate-limited us this request — devices poll is separate.
    let device = playbackState?.device || null;
    const alreadyRateLimited = spotifyErrors.some(
      (err) =>
        err.includes('429') ||
        err.includes('backoff') ||
        err.includes('rate limited')
    );
    if (!device && !alreadyRateLimited) {
      try {
        const devicesData = await spotifyService.getAvailableDevices(userId);
        const active = devicesData?.devices?.find((d: any) => d.is_active);
        device = active || devicesData?.devices?.[0] || null;
      } catch {
        // best-effort only
      }
    }

    const playbackPending = Boolean(spotifyConnected && !currentTrack);

    console.log(
      `🎯 [${requestId}] Queue details endpoint completed (${Date.now() - startTime}ms total)`
    );

    return NextResponse.json({
      current_track: currentTrack,
      queue: queueItems,
      device,
      is_playing: Boolean(
        playbackState?.is_playing ?? currentTrack?.is_playing ?? false
      ),
      shuffle_state: playbackState?.shuffle_state || false,
      repeat_state: playbackState?.repeat_state || 'off',
      spotify_connected: spotifyConnected,
      playback_pending: playbackPending,
      debug: {
        request_id: requestId,
        has_valid_connection: spotifyConnected,
        spotify_errors: spotifyErrors,
        total_duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      `❌ Error in queue details endpoint (${Date.now() - startTime}ms):`,
      error
    );

    if (
      error instanceof Error &&
      (error.message.includes('No token provided') ||
        error.message.includes('Admin access required'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'Failed to get queue details',
        spotify_connected: false,
        playback_pending: false,
      },
      { status: 500 }
    );
  }
}
