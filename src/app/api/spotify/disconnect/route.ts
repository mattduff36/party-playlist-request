import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { clearSpotifyAuth } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    await clearSpotifyAuth();
    
    return NextResponse.json({
      success: true,
      message: 'Spotify account disconnected successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error disconnecting Spotify:', error);
    return NextResponse.json({ 
      error: 'Failed to disconnect Spotify account' 
    }, { status: 500 });
  }
}