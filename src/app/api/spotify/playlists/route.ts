import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  buildPlaylistCacheKey,
  getCachedPlaylists,
  setCachedPlaylists,
} from '@/lib/playlist-cache';
import {
  SPOTIFY_LIKED_SONGS_ID,
  spotifyService,
  type SpotifyPlaylist,
} from '@/lib/spotify';

/** Never statically cache authenticated playlist responses. */
export const dynamic = 'force-dynamic';

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

interface PlaylistsPayload {
  connected: boolean;
  playlists: SpotifyPlaylist[];
  needs_reconnect: boolean;
  spotify_user_id?: string | null;
  error?: string;
  code?: string;
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate, max-age=0'
  );
  response.headers.set('CDN-Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, Authorization');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

/** List Spotify playlists for browse + queue (read-only). */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return withNoStore(auth.response!);
    }

    const userId = auth.user.user_id;
    if (!userId) {
      return withNoStore(
        NextResponse.json(
          { error: 'Authenticated session is missing user id', code: 'NO_USER_ID' },
          { status: 401 }
        )
      );
    }

    const isConnected = await spotifyService.isConnected(userId);
    if (!isConnected) {
      return withNoStore(
        NextResponse.json({
          connected: false,
          playlists: [],
          needs_reconnect: false,
          spotify_user_id: null,
        } satisfies PlaylistsPayload)
      );
    }

    const hasReadScopes = await spotifyService.hasPlaylistReadScopes(userId);
    if (!hasReadScopes) {
      return withNoStore(
        NextResponse.json(
          {
            connected: true,
            playlists: [],
            needs_reconnect: true,
            spotify_user_id: null,
            error:
              'Spotify needs to be reconnected to grant playlist read access. Disconnect and connect again.',
            code: 'MISSING_PLAYLIST_SCOPES',
          } satisfies PlaylistsPayload,
          { status: 403 }
        )
      );
    }

    try {
      // Resolve Spotify account id first so the cache key is tenant + Spotify scoped
      let spotifyUserId: string | null = null;
      try {
        const profile = await spotifyService.getUserProfile(userId);
        spotifyUserId =
          typeof profile?.id === 'string' && profile.id.trim()
            ? profile.id.trim()
            : null;
      } catch (profileError) {
        console.warn('Could not load Spotify profile id for playlist cache key:', profileError);
      }

      const cacheKey = buildPlaylistCacheKey(userId, spotifyUserId);
      const cached = getCachedPlaylists<PlaylistsPayload>(cacheKey);
      if (cached) {
        return withNoStore(NextResponse.json(cached));
      }

      const playlists = await spotifyService.getUserPlaylists(userId);

      // Liked Songs always pinned first (saved tracks via GET /me/tracks)
      let liked: SpotifyPlaylist = {
        id: SPOTIFY_LIKED_SONGS_ID,
        name: 'Liked Songs',
        uri: 'spotify:collection:tracks',
        collaborative: false,
        public: false,
        track_count: 0,
        owner_name: 'You',
      };
      const hasLibraryScopes = await spotifyService.hasLibraryReadScopes(userId);
      if (hasLibraryScopes) {
        try {
          liked = await spotifyService.getLikedSongsPlaylist(userId);
        } catch (likedError) {
          console.warn('Could not load Liked Songs meta; using stub entry:', likedError);
        }
      }

      const payload: PlaylistsPayload = {
        connected: true,
        playlists: [liked, ...playlists],
        needs_reconnect: false,
        spotify_user_id: spotifyUserId,
      };
      setCachedPlaylists(cacheKey, payload);

      return withNoStore(NextResponse.json(payload));
    } catch (error) {
      const status = parseSpotifyStatus(error) ?? 500;
      console.error('Error fetching Spotify playlists:', error);

      if (status === 401) {
        return withNoStore(
          NextResponse.json(
            {
              connected: false,
              playlists: [],
              needs_reconnect: true,
              spotify_user_id: null,
              error: 'Spotify session expired. Please reconnect Spotify.',
              code: 'SPOTIFY_UNAUTHORIZED',
            } satisfies PlaylistsPayload,
            { status: 401 }
          )
        );
      }

      if (status === 403) {
        return withNoStore(
          NextResponse.json(
            {
              connected: true,
              playlists: [],
              needs_reconnect: true,
              spotify_user_id: null,
              error:
                'Spotify denied playlist access. Disconnect and reconnect Spotify to grant playlist permissions.',
              code: 'SPOTIFY_FORBIDDEN',
            } satisfies PlaylistsPayload,
            { status: 403 }
          )
        );
      }

      if (status === 429) {
        return withNoStore(
          NextResponse.json(
            {
              connected: true,
              playlists: [],
              needs_reconnect: false,
              spotify_user_id: null,
              error: 'Spotify is rate limiting playlist requests. Try again in a moment.',
              code: 'SPOTIFY_RATE_LIMITED',
            } satisfies PlaylistsPayload,
            { status: 429 }
          )
        );
      }

      return withNoStore(
        NextResponse.json(
          {
            connected: true,
            playlists: [],
            needs_reconnect: false,
            spotify_user_id: null,
            error: error instanceof Error ? error.message : 'Failed to fetch playlists',
          } satisfies PlaylistsPayload,
          { status: 500 }
        )
      );
    }
  } catch (error) {
    console.error('Error in /api/spotify/playlists:', error);
    return withNoStore(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  }
}
