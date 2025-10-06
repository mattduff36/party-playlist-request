import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Get user_id from username
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current playback from Spotify
    // TODO: In full multi-tenant, this should use user-specific Spotify tokens
    const playback = await spotifyService.getCurrentPlayback();

    if (!playback || !playback.item) {
      return NextResponse.json({
        nowPlaying: null
      });
    }

    return NextResponse.json({
      nowPlaying: {
        track_name: playback.item.name,
        artist_name: playback.item.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
        album_name: playback.item.album?.name || 'Unknown Album',
        duration_ms: playback.item.duration_ms || 0,
        progress_ms: playback.progress_ms || 0,
        is_playing: playback.is_playing || false,
      }
    });

  } catch (error) {
    console.error('Error fetching now playing:', error);
    return NextResponse.json(
      { nowPlaying: null },
      { status: 200 } // Return null instead of error for graceful degradation
    );
  }
}

