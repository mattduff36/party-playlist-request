import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequest, updateRequest } from '@/lib/db';
import {
  clearManualNowPlaying,
  getManualNowPlaying,
  getPlaybackMode,
  setManualNowPlaying,
} from '@/lib/playback';

/**
 * Set / clear app-owned now-playing for manual mode (PRD-07).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    const nowPlaying = await getManualNowPlaying(auth.user.user_id);
    return NextResponse.json({ success: true, nowPlaying });
  } catch (error) {
    console.error('manual-now-playing GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load manual now playing' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const mode = await getPlaybackMode(userId);
    if (mode !== 'manual') {
      return NextResponse.json(
        {
          error: 'Manual now-playing is only available in manual mode',
          code: 'WRONG_MODE',
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    if (body.clear === true) {
      await clearManualNowPlaying(userId);
      return NextResponse.json({ success: true, nowPlaying: null });
    }

    let title = typeof body.title === 'string' ? body.title.trim() : '';
    let artists = typeof body.artists === 'string' ? body.artists.trim() : '';
    let album: string | null =
      typeof body.album === 'string' ? body.album.trim() : null;
    let artworkUrl: string | null =
      typeof body.artworkUrl === 'string' ? body.artworkUrl.trim() : null;
    const requestId: string | null =
      typeof body.requestId === 'string' ? body.requestId : null;

    if (requestId) {
      const request = await getRequest(requestId, userId);
      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }
      title = request.track_name;
      artists = request.artist_name;
      album = request.album_name || null;
      artworkUrl = request.album_image_url || null;
      await updateRequest(
        requestId,
        { status: 'approved' },
        userId
      ).catch(() => null);
      // Mark as playing via status when organiser chooses a queue item
      await updateRequest(requestId, { status: 'queued' }, userId).catch(() => null);
    }

    if (!title || !artists) {
      return NextResponse.json(
        { error: 'title and artists are required (or requestId)' },
        { status: 400 }
      );
    }

    const nowPlaying = await setManualNowPlaying(userId, {
      requestId,
      title,
      artists,
      album,
      artworkUrl,
      setAt: new Date().toISOString(),
      setBy: auth.user.username,
    });

    return NextResponse.json({ success: true, nowPlaying });
  } catch (error) {
    console.error('manual-now-playing POST error:', error);
    return NextResponse.json(
      { error: 'Failed to set manual now playing' },
      { status: 500 }
    );
  }
}
