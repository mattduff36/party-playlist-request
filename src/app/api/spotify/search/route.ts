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

    console.log(`🔍 Searching Spotify for: "${query}" (limit: ${limit})`);

    const response = await spotifyService.searchTracks(query, limit);
    
    // Spotify API returns { tracks: { items: [...] } }
    const tracks = response?.tracks?.items || [];

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
    console.error('Spotify search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Spotify' },
      { status: 500 }
    );
  }
}

