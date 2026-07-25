import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getSetting } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

function parseSpotifyStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/Spotify API error:\s*(\d{3})/);
  if (match) return parseInt(match[1], 10);
  if (/\b401\b/.test(error.message) || /Authentication failed/i.test(error.message)) {
    return 401;
  }
  if (/\b429\b/.test(error.message)) return 429;
  if (/\b403\b/.test(error.message)) return 403;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;

    const isConnected = await spotifyService.isConnected(userId);
    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        playlists: [],
        party_playlist_id: null,
        needs_reconnect: false,
      });
    }

    const hasReadScopes = await spotifyService.hasPlaylistReadScopes(userId);
    if (!hasReadScopes) {
      return NextResponse.json(
        {
          connected: true,
          playlists: [],
          party_playlist_id: (await getSetting('party_playlist_id')) || null,
          needs_reconnect: true,
          error:
            'Spotify needs to be reconnected to grant playlist read access. Disconnect and connect again.',
          code: 'MISSING_PLAYLIST_SCOPES',
        },
        { status: 403 }
      );
    }

    try {
      const playlists = await spotifyService.getUserPlaylists(userId);
      const partyPlaylistId = (await getSetting('party_playlist_id')) || null;

      return NextResponse.json({
        connected: true,
        playlists,
        party_playlist_id: partyPlaylistId,
        needs_reconnect: false,
      });
    } catch (error) {
      const status = parseSpotifyStatus(error) ?? 500;
      console.error('Error fetching Spotify playlists:', error);

      if (status === 401) {
        return NextResponse.json(
          {
            connected: false,
            playlists: [],
            party_playlist_id: null,
            needs_reconnect: true,
            error: 'Spotify session expired. Please reconnect Spotify.',
            code: 'SPOTIFY_UNAUTHORIZED',
          },
          { status: 401 }
        );
      }

      if (status === 403) {
        return NextResponse.json(
          {
            connected: true,
            playlists: [],
            party_playlist_id: (await getSetting('party_playlist_id')) || null,
            needs_reconnect: true,
            error:
              'Spotify denied playlist access. Disconnect and reconnect Spotify to grant playlist permissions.',
            code: 'SPOTIFY_FORBIDDEN',
          },
          { status: 403 }
        );
      }

      if (status === 429) {
        return NextResponse.json(
          {
            connected: true,
            playlists: [],
            party_playlist_id: (await getSetting('party_playlist_id')) || null,
            needs_reconnect: false,
            error: 'Spotify is rate limiting playlist requests. Try again in a moment.',
            code: 'SPOTIFY_RATE_LIMITED',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          connected: true,
          playlists: [],
          party_playlist_id: (await getSetting('party_playlist_id')) || null,
          needs_reconnect: false,
          error: error instanceof Error ? error.message : 'Failed to fetch playlists',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in /api/spotify/playlists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
