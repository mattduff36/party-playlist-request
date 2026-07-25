import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getSetting } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

/**
 * Queue every readable track from a Spotify playlist.
 * Read-only for the playlist itself — never writes to the playlist.
 * Spotify's queue API accepts one track URI at a time.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const body = await req.json();
    const playlistId =
      typeof body?.playlist_id === 'string' ? body.playlist_id.trim() : '';
    const deviceId =
      typeof body?.device_id === 'string' && body.device_id.trim()
        ? body.device_id.trim()
        : (await getSetting('target_device_id')) || undefined;

    if (!playlistId || !/^[a-zA-Z0-9]{10,40}$/.test(playlistId)) {
      return NextResponse.json({ error: 'Valid playlist_id is required' }, { status: 400 });
    }

    const tracks = await spotifyService.getPlaylistItems(playlistId, userId, {
      maxTracks: 100,
    });

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          error:
            'No queueable tracks found. Spotify only exposes tracks for playlists you own or collaborate on.',
          queued: 0,
          failed: 0,
        },
        { status: 404 }
      );
    }

    let queued = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const track of tracks) {
      try {
        await spotifyService.addToQueue(track.uri, deviceId || undefined, userId);
        queued += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < 5) {
          errors.push(
            error instanceof Error
              ? `${track.name}: ${error.message}`
              : `Failed to queue ${track.name}`
          );
        }
      }
    }

    console.log(
      `🎵 [queue/playlist] User ${auth.user.username} queued ${queued}/${tracks.length} from playlist ${playlistId}`
    );

    return NextResponse.json({
      success: queued > 0,
      playlist_id: playlistId,
      queued,
      failed,
      total: tracks.length,
      truncated: tracks.length >= 100,
      errors: errors.length > 0 ? errors : null,
      message:
        queued > 0
          ? `Queued ${queued} track${queued === 1 ? '' : 's'}${failed ? ` (${failed} failed)` : ''}`
          : 'Failed to queue any tracks',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error queuing playlist:', error);
    return NextResponse.json({ error: 'Failed to queue playlist' }, { status: 500 });
  }
}
