import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';
import { setSetting } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const body = await req.json();
    const { name = 'Party DJ Requests', description = 'Songs requested at the party', public: isPublic = false } = body;
    
    const playlist = await spotifyService.createPlaylist(name, description, isPublic);

    // Update settings with new playlist ID
    await setSetting('party_playlist_id', playlist.id);

    return NextResponse.json({
      success: true,
      message: 'Party playlist created successfully',
      playlist: playlist
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error creating playlist:', error);
    return NextResponse.json({ 
      error: 'Failed to create playlist' 
    }, { status: 500 });
  }
}