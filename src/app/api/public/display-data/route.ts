import { NextRequest, NextResponse } from 'next/server';
import { getEventSettings, getRequestsByStatus } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';
import { requireGuestAccess } from '@/lib/guest-access';
import { getTrackAlbumImageUrl } from '@/lib/spotify-album-art';

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;
    const settings = await getEventSettings(userId);

    let currentTrack = null;
    let upcomingSongs: Array<Record<string, unknown>> = [];

    try {
      const playbackState = await spotifyService.getCurrentPlayback(userId);

      if (playbackState && playbackState.item) {
        const albumArt = playbackState.item.album?.images?.[0]?.url || null;

        currentTrack = {
          name: playbackState.item.name,
          artists: playbackState.item.artists.map((a: { name: string }) => a.name),
          album: playbackState.item.album.name,
          duration_ms: playbackState.item.duration_ms,
          progress_ms: playbackState.progress_ms,
          uri: playbackState.item.uri,
          image_url: albumArt,
        };
      }

      const queueData = await spotifyService.getQueue(userId);
      const approvedRequests = await getRequestsByStatus('approved', 20, 0, userId);

      if (queueData && queueData.queue) {
        upcomingSongs = queueData.queue.map((track: {
          name: string;
          artists: Array<string | { name: string }>;
          album?: { name?: string; images?: Array<{ url?: string }> };
          uri: string;
          image_url?: string | null;
        }) => {
          const matchingRequest = approvedRequests.find(
            (req) => req.track_uri === track.uri
          );

          return {
            name: track.name,
            artists: Array.isArray(track.artists)
              ? track.artists.map((a) => (typeof a === 'string' ? a : a.name))
              : [],
            album: track.album?.name || '',
            uri: track.uri,
            // Album art is already on Spotify TrackObject from /me/player/queue
            image_url: getTrackAlbumImageUrl(track) || null,
            requester_nickname: matchingRequest?.requester_nickname || null,
          };
        });

        console.log(
          `✅ Loaded ${upcomingSongs.length} upcoming songs from Spotify queue for user ${userId}`
        );
      }
    } catch (error) {
      console.error('Error fetching Spotify data:', error);
    }

    return NextResponse.json(
      {
        event_settings: {
          event_title: settings.event_title || 'Party DJ Requests',
          dj_name: settings.dj_name ?? '',
          venue_info: settings.venue_info ?? '',
          welcome_message: settings.welcome_message || 'Request your favorite songs!',
          secondary_message: settings.secondary_message ?? '',
          tertiary_message: settings.tertiary_message ?? '',
          show_qr_code: settings.show_qr_code ?? true,
          display_refresh_interval: settings.display_refresh_interval || 20,
          display_mood: settings.display_mood ?? null,
          theme_primary_color: settings.theme_primary_color ?? null,
          show_scrolling_bar: settings.show_scrolling_bar !== false,
          decline_explicit: settings.decline_explicit ?? false,
          // Access code only for authenticated guest/owner (needed for QR on display)
          access_code: access.accessCode,
        },
        current_track: currentTrack,
        upcoming_songs: upcomingSongs,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching display data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch display data' },
      { status: 500 }
    );
  }
}
