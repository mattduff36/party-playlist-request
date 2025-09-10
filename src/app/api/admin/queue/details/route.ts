import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    // Get both current playback and queue
    const [playbackState, queueData] = await Promise.all([
      spotifyService.getCurrentPlayback(),
      spotifyService.getQueue()
    ]);
    
    // Process current track with album art
    let currentTrack = null;
    if (playbackState?.item) {
      const albumArt = await spotifyService.getAlbumArt(playbackState.item.uri);
      currentTrack = {
        ...playbackState.item,
        image_url: albumArt,
        progress_ms: playbackState.progress_ms,
        is_playing: playbackState.is_playing
      };
    }
    
    // Process queue items with album art
    let queueItems = [];
    if (queueData?.queue) {
      queueItems = await Promise.all(
        queueData.queue.slice(0, 10).map(async (item: any) => {
          const albumArt = await spotifyService.getAlbumArt(item.uri);
          return {
            ...item,
            image_url: albumArt
          };
        })
      );
    }
    
    return NextResponse.json({
      current_track: currentTrack,
      queue: queueItems,
      device: playbackState?.device || null,
      is_playing: playbackState?.is_playing || false,
      shuffle_state: playbackState?.shuffle_state || false,
      repeat_state: playbackState?.repeat_state || 'off'
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error getting queue details:', error);
    return NextResponse.json({ 
      error: 'Failed to get queue details' 
    }, { status: 500 });
  }
}
