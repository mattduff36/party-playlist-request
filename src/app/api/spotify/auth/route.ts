import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    console.log('Spotify auth endpoint called');
    await authService.requireAdminAuth(req);
    
    console.log('Admin auth verified, generating Spotify auth URL...');
    const authData = spotifyService.getAuthorizationURL();
    
    console.log('Spotify auth URL generated:', { 
      hasUrl: !!authData.url, 
      urlLength: authData.url?.length,
      hasState: !!authData.state 
    });
    
    return NextResponse.json({
      auth_url: authData.url,
      state: authData.state,
      code_challenge: authData.codeChallenge,
      code_verifier: authData.codeVerifier
    });

  } catch (error) {
    console.error('Error in Spotify auth endpoint:', error);
    
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to start Spotify authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}