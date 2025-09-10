import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const playlists = await spotifyService.getPlaylists();

    return NextResponse.json({
      playlists: playlists
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error getting playlists:', error);
    return NextResponse.json({ 
      error: 'Failed to get playlists' 
    }, { status: 500 });
  }
}