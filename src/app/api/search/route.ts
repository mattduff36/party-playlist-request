import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { hashIP } from '@/lib/db';
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
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const username = searchParams.get('username');

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
      `${hashIP(clientIP)}:${username || 'anon'}`
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
    
    console.log(`🔍 [API /api/search] Query: "${query}", Username: ${username}, Limit: ${limit}`);

    // MULTI-TENANT: Get userId from username
    let userId: string | null = null;
    if (username) {
      const { getPool } = await import('@/lib/db');
      const pool = getPool();
      const userResult = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    // Feb 2026 Spotify search max limit is 10
    const searchLimit = Math.min(limit || 10, 10);
    const cacheKey = buildSearchCacheKey(userId, query, searchLimit);
    const cached = getCachedSearch<{ tracks: unknown[]; query: string; total: number }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`🔍 [API /api/search] Calling spotifyService.searchTracks with userId: ${userId}`);
    const searchResult = await spotifyService.searchTracks(
      query.trim(),
      searchLimit,
      userId ?? undefined
    );
    
    // Extract tracks from Spotify API response
    const tracks = searchResult?.tracks?.items || [];
    console.log(`🔍 [API /api/search] Found ${tracks.length} tracks`);

    const payload = {
      tracks: tracks,
      query: query.trim(),
      total: tracks.length
    };
    setCachedSearch(cacheKey, payload);
    
    return NextResponse.json(payload);

  } catch (error) {
    console.error('Error searching tracks:', error);

    if (isSpotifySearchBusyError(error)) {
      return NextResponse.json({
        code: SPOTIFY_SEARCH_BUSY_CODE,
        error: SPOTIFY_SEARCH_BUSY_MESSAGE
      }, { status: 429 });
    }
    
    if (error instanceof Error && error.message.includes('authentication')) {
      return NextResponse.json({ 
        error: 'Music search is temporarily unavailable. Please try again later.' 
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to search tracks. Please try again.' 
    }, { status: 500 });
  }
}