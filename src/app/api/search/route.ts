import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { initializeDefaults } from '@/lib/db';
import {
  isSpotifySearchBusyError,
  SPOTIFY_SEARCH_BUSY_CODE,
  SPOTIFY_SEARCH_BUSY_MESSAGE
} from '@/lib/spotify-search-errors';

export async function GET(req: NextRequest) {
  try {
    await initializeDefaults();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const username = searchParams.get('username');
    
    console.log(`🔍 [API /api/search] Query: "${query}", Username: ${username}, Limit: ${limit}`);
    
    if (!query || query.trim().length < 2) {
      console.log('❌ [API /api/search] Query too short');
      return NextResponse.json({ 
        error: 'Search query must be at least 2 characters long' 
      }, { status: 400 });
    }

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
    
    console.log(`🔍 [API /api/search] Calling spotifyService.searchTracks with userId: ${userId}`);
    const searchResult = await spotifyService.searchTracks(query.trim(), searchLimit, userId);
    
    // Extract tracks from Spotify API response
    const tracks = searchResult?.tracks?.items || [];
    console.log(`🔍 [API /api/search] Found ${tracks.length} tracks`);
    
    return NextResponse.json({
      tracks: tracks,
      query: query.trim(),
      total: tracks.length
    });

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