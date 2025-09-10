import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const playbackState = await spotifyService.getCurrentPlayback();
    
    if (!playbackState) {
      return NextResponse.json({
        is_playing: false,
        current_track: null,
        queue: [],
        device: null,
        message: 'No active playback device found'
      });
    }

    return NextResponse.json({
      is_playing: playbackState.is_playing,
      current_track: playbackState.item ? {
        name: playbackState.item.name,
        artists: playbackState.item.artists.map((a: any) => a.name),
        album: playbackState.item.album.name,
        duration_ms: playbackState.item.duration_ms,
        progress_ms: playbackState.progress_ms,
        uri: playbackState.item.uri
      } : null,
      device: playbackState.device ? {
        id: playbackState.device.id,
        name: playbackState.device.name,
        type: playbackState.device.type,
        volume_percent: playbackState.device.volume_percent
      } : null,
      shuffle_state: playbackState.shuffle_state,
      repeat_state: playbackState.repeat_state
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error getting queue:', error);
    return NextResponse.json({ 
      error: 'Failed to get playback queue' 
    }, { status: 500 });
  }
}