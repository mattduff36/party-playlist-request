import { NextRequest, NextResponse } from 'next/server';
import { getPool, hashIP } from '@/lib/db';
import {
  isSpotifySearchBusyError,
  SPOTIFY_SEARCH_BUSY_CODE,
  SPOTIFY_SEARCH_BUSY_MESSAGE
} from '@/lib/spotify-search-errors';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  buildSearchCacheKey,
  getCachedSearch,
  setCachedSearch,
} from '@/lib/search-cache';
import { requireGuestAccess } from '@/lib/guest-access';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const username = searchParams.get('username');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Validate before guest auth so short queries stay 400 under suite load.
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters long' },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    const access = await requireGuestAccess(req, username);
    if (!access.ok) {
      return access.response;
    }

    const clientIP = getClientIp(req);
    const rateLimitCheck = checkRateLimit(
      'guestSearch',
      `${hashIP(clientIP)}:${username}`
    );
    if (!rateLimitCheck.allowed) {
      const response = NextResponse.json(
        { error: rateLimitCheck.message },
        { status: 429 }
      );
      if (rateLimitCheck.retryAfter) {
        response.headers.set('Retry-After', String(rateLimitCheck.retryAfter));
      }
      return response;
    }

    console.log(`🔍 [search] User ${username} searching for: "${query}" (limit: ${limit})`);

    // Get user's Spotify tokens from database
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
    const searchLimit = Math.min(Math.max(limit || 10, 1), 10);
    const cacheKey = buildSearchCacheKey(userId, query, searchLimit);
    const cached = getCachedSearch<{ tracks: unknown[]; query: string; total: number }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Test / finalise mock path — no live Spotify tokens required
    if (process.env.SPOTIFY_MOCK === 'true') {
      const { spotifyService } = await import('@/lib/spotify');
      const searchResult = await spotifyService.searchTracks(query.trim(), searchLimit, userId);
      const tracks = searchResult?.tracks?.items || [];
      const payload = {
        tracks,
        query: query.trim(),
        total: tracks.length,
      };
      setCachedSearch(cacheKey, payload);
      return NextResponse.json(payload);
    }

    // Get user's Spotify auth tokens
    const authResult = await pool.query(
      'SELECT access_token, refresh_token, expires_at FROM spotify_auth WHERE user_id = $1',
      [userId]
    );

    if (authResult.rows.length === 0) {
      console.log(`⚠️ [search] User ${username} has not connected Spotify`);
      return NextResponse.json(
        { error: 'Spotify not connected. Please connect your Spotify account in the admin panel.' },
        { status: 503 }
      );
    }

    const auth = authResult.rows[0];

    // Check if token is expired and refresh if needed
    if (new Date(auth.expires_at) <= new Date()) {
      console.log(`🔄 [search] Access token expired for ${username}, refreshing...`);
      
      // Import spotify service to refresh token
      const { spotifyService } = await import('@/lib/spotify');
      try {
        await spotifyService.refreshAccessToken(userId);
        
        // Get updated token
        const refreshedResult = await pool.query(
          'SELECT access_token FROM spotify_auth WHERE user_id = $1',
          [userId]
        );
        auth.access_token = refreshedResult.rows[0].access_token;
      } catch (refreshError) {
        console.error(`❌ [search] Failed to refresh token for ${username}:`, refreshError);

        if (isSpotifySearchBusyError(refreshError)) {
          return NextResponse.json(
            {
              code: SPOTIFY_SEARCH_BUSY_CODE,
              error: SPOTIFY_SEARCH_BUSY_MESSAGE
            },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: 'Spotify connection expired. Please reconnect in the admin panel.' },
          { status: 503 }
        );
      }
    }

    // Search using user's Spotify tokens (Feb 2026: max limit is 10)
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query.trim())}&type=track&limit=${searchLimit}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${auth.access_token}`
      }
    });

    if (searchResponse.status === 429) {
      const { logErrorAsync } = await import('@/lib/support/logger');
      logErrorAsync({
        source: 'spotify',
        classification: 'handled',
        message: `Spotify search 429 for ${username}`,
        route: '/api/spotify/search',
        method: 'GET',
        username,
        meta: {
          query: query.slice(0, 80),
          status: 429,
          handled: true,
          expected: true,
        },
      });
      const response = NextResponse.json(
        {
          code: SPOTIFY_SEARCH_BUSY_CODE,
          error: SPOTIFY_SEARCH_BUSY_MESSAGE
        },
        { status: 429 }
      );
      const retryAfter = searchResponse.headers.get('Retry-After');

      if (retryAfter) response.headers.set('Retry-After', retryAfter);

      return response;
    }

    if (!searchResponse.ok) {
      console.error(`❌ [search] Spotify API error: ${searchResponse.status} ${searchResponse.statusText}`);
      const isTransientUpstream = [502, 503, 504].includes(searchResponse.status);
      const { logErrorAsync } = await import('@/lib/support/logger');
      logErrorAsync({
        source: 'spotify',
        classification:
          isTransientUpstream || searchResponse.status < 500
            ? 'handled'
            : 'unhandled',
        message: `Spotify search ${searchResponse.status} for ${username}`,
        route: '/api/spotify/search',
        method: 'GET',
        username,
        meta: {
          status: searchResponse.status,
          handled: isTransientUpstream || searchResponse.status < 500,
          expected: isTransientUpstream,
          transient: isTransientUpstream,
        },
      });
      return NextResponse.json(
        { error: 'Music search is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const searchResult = await searchResponse.json();
    const tracks = searchResult?.tracks?.items || [];

    console.log(`✅ [search] Found ${tracks.length} tracks for ${username}`);

    const payload = {
      tracks: tracks,
      query: query.trim(),
      total: tracks.length
    };
    setCachedSearch(cacheKey, payload);

    return NextResponse.json(payload);

  } catch (error) {
    console.error('❌ [search] Error:', error);
    
    if (error instanceof Error && error.message.includes('authentication')) {
      return NextResponse.json(
        { error: 'Music search is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to search tracks. Please try again.' },
      { status: 500 }
    );
  }
}

