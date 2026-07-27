import { NextRequest, NextResponse } from 'next/server';
import { requireGuestAccess } from '@/lib/guest-access';
import {
  getManualNowPlaying,
  getPlaybackMode,
  resolvePlaybackProvider,
} from '@/lib/playback';

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

    const access = await requireGuestAccess(req, username);
    if (!access.ok) {
      return access.response;
    }

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

    const userId = userResult.rows[0].id;
    const mode = await getPlaybackMode(userId);

    if (mode === 'manual') {
      const manual = await getManualNowPlaying(userId);
      if (!manual) {
        return NextResponse.json({
          nowPlaying: null,
          playback_mode: 'manual',
          label: 'Manual mode',
        });
      }
      return NextResponse.json({
        nowPlaying: {
          track_name: manual.title,
          artist_name: manual.artists,
          album_name: manual.album || 'Manual request',
          duration_ms: 0,
          progress_ms: 0,
          is_playing: true,
        },
        playback_mode: 'manual',
        label: 'Manual now playing',
      });
    }

    const { provider } = await resolvePlaybackProvider(userId);
    if (!provider.getPlaybackState) {
      return NextResponse.json({ nowPlaying: null, playback_mode: mode });
    }
    const snapshot = await provider.getPlaybackState({ userId });
    if (!snapshot.track) {
      return NextResponse.json({ nowPlaying: null, playback_mode: mode });
    }

    return NextResponse.json({
      nowPlaying: {
        track_name: snapshot.track.title,
        artist_name: snapshot.track.artists,
        album_name: snapshot.track.album || 'Unknown Album',
        duration_ms: snapshot.durationMs || snapshot.track.durationMs || 0,
        progress_ms: snapshot.progressMs || 0,
        is_playing: snapshot.isPlaying,
      },
      playback_mode: mode,
    });
  } catch (error) {
    console.error('Error fetching now playing:', error);
    return NextResponse.json(
      { nowPlaying: null },
      { status: 200 }
    );
  }
}
