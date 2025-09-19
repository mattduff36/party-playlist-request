import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { initializeDefaults } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await initializeDefaults();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        error: 'Search query must be at least 2 characters long' 
      }, { status: 400 });
    }

    const searchLimit = Math.min(limit || 20, 50);
    
    const searchResult = await spotifyService.searchTracks(query.trim(), searchLimit);
    
    // Extract tracks from Spotify API response
    const tracks = searchResult?.tracks?.items || [];
    
    return NextResponse.json({
      tracks: tracks,
      query: query.trim(),
      total: tracks.length
    });

  } catch (error) {
    console.error('Error searching tracks:', error);
    
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