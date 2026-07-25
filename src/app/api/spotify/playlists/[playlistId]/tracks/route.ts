import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { isLikedSongsPlaylistId, spotifyService } from '@/lib/spotify';

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

function isValidPlaylistId(playlistId: string): boolean {
  return isLikedSongsPlaylistId(playlistId) || /^[a-zA-Z0-9]{10,40}$/.test(playlistId);
}

interface RouteParams {
  params: Promise<{ playlistId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const { playlistId } = await params;

    if (!playlistId || !isValidPlaylistId(playlistId)) {
      return NextResponse.json({ error: 'Invalid playlist id' }, { status: 400 });
    }

    const isConnected = await spotifyService.isConnected(userId);
    if (!isConnected) {
      return NextResponse.json(
        { connected: false, tracks: [], error: 'Spotify is not connected' },
        { status: 400 }
      );
    }

    const isLikedSongs = isLikedSongsPlaylistId(playlistId);

    if (isLikedSongs) {
      const hasLibraryScopes = await spotifyService.hasLibraryReadScopes(userId);
      if (!hasLibraryScopes) {
        return NextResponse.json(
          {
            connected: true,
            tracks: [],
            needs_reconnect: true,
            error:
              'Spotify needs to be reconnected to grant Liked Songs (library) access. Disconnect and connect again.',
            code: 'MISSING_LIBRARY_SCOPES',
          },
          { status: 403 }
        );
      }
    } else {
      const hasReadScopes = await spotifyService.hasPlaylistReadScopes(userId);
      if (!hasReadScopes) {
        return NextResponse.json(
          {
            connected: true,
            tracks: [],
            needs_reconnect: true,
            error:
              'Spotify needs to be reconnected to grant playlist read access. Disconnect and connect again.',
            code: 'MISSING_PLAYLIST_SCOPES',
          },
          { status: 403 }
        );
      }
    }

    try {
      const tracks = await spotifyService.getPlaylistItems(playlistId, userId);
      return NextResponse.json({
        connected: true,
        playlist_id: playlistId,
        tracks,
        truncated: tracks.length >= 200,
      });
    } catch (error) {
      const status = parseSpotifyStatus(error) ?? 500;
      console.error('Error fetching playlist tracks:', error);

      if (status === 403) {
        return NextResponse.json(
          {
            connected: true,
            tracks: [],
            error: isLikedSongs
              ? 'Spotify denied access to Liked Songs. Disconnect and reconnect Spotify to grant library permissions.'
              : 'Spotify only allows reading tracks from playlists you own or collaborate on.',
            code: isLikedSongs ? 'LIBRARY_ITEMS_FORBIDDEN' : 'PLAYLIST_ITEMS_FORBIDDEN',
            needs_reconnect: isLikedSongs,
          },
          { status: 403 }
        );
      }

      if (status === 401) {
        return NextResponse.json(
          {
            connected: false,
            tracks: [],
            needs_reconnect: true,
            error: 'Spotify session expired. Please reconnect Spotify.',
            code: 'SPOTIFY_UNAUTHORIZED',
          },
          { status: 401 }
        );
      }

      if (status === 429) {
        return NextResponse.json(
          {
            connected: true,
            tracks: [],
            error: 'Spotify is rate limiting playlist requests. Try again in a moment.',
            code: 'SPOTIFY_RATE_LIMITED',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          connected: true,
          tracks: [],
          error: error instanceof Error ? error.message : 'Failed to fetch playlist tracks',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in /api/spotify/playlists/[playlistId]/tracks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
