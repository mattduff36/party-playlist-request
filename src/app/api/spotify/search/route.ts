import { NextRequest, NextResponse } from 'next/server';
import { initializeDefaults, getPool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await initializeDefaults();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const username = searchParams.get('username');
    const limit = parseInt(searchParams.get('limit') || '20');

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
        return NextResponse.json(
          { error: 'Spotify connection expired. Please reconnect in the admin panel.' },
          { status: 503 }
        );
      }
    }

    // Search using user's Spotify tokens
    const searchLimit = Math.min(limit, 50);
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query.trim())}&type=track&limit=${searchLimit}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${auth.access_token}`
      }
    });

    if (!searchResponse.ok) {
      console.error(`❌ [search] Spotify API error: ${searchResponse.status} ${searchResponse.statusText}`);
      return NextResponse.json(
        { error: 'Music search is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const searchResult = await searchResponse.json();
    const tracks = searchResult?.tracks?.items || [];

    console.log(`✅ [search] Found ${tracks.length} tracks for ${username}`);

    return NextResponse.json({
      tracks: tracks,
      query: query.trim(),
      total: tracks.length
    });

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

