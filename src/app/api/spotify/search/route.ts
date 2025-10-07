import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [PUBLIC] Searching Spotify for: "${query}" (limit: ${limit})`);

    // Use public search (Client Credentials) - no user auth required
    const response = await spotifyService.searchTracksPublic(query, limit);
    
    // Spotify API returns { tracks: { items: [...] } }
    const tracks = response?.tracks?.items || [];

    console.log(`✅ [PUBLIC] Found ${tracks.length} tracks`);

    return NextResponse.json({
      tracks: tracks.map((track: any) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists?.map((a: any) => a.name) || [],
        album: track.album?.name || 'Unknown Album',
        duration_ms: track.duration_ms || 0,
        explicit: track.explicit || false,
        preview_url: track.preview_url,
        image: track.album?.images?.[0]?.url
      }))
    });

  } catch (error) {
    console.error('❌ [PUBLIC] Spotify search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Spotify', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

