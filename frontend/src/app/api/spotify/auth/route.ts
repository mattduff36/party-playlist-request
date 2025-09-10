import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const authData = spotifyService.getAuthorizationURL();
    
    return NextResponse.json({
      auth_url: authData.url,
      state: authData.state,
      code_challenge: authData.codeChallenge
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error starting Spotify auth:', error);
    return NextResponse.json({ 
      error: 'Failed to start Spotify authentication' 
    }, { status: 500 });
  }
}