import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const body = await req.json();
    const { code, state, code_verifier } = body;
    
    if (!code || !code_verifier) {
      return NextResponse.json({ 
        error: 'Authorization code and code verifier are required' 
      }, { status: 400 });
    }

    const tokenData = await spotifyService.exchangeCodeForToken(code, code_verifier);
    
    return NextResponse.json({
      success: true,
      message: 'Spotify authentication successful',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error in Spotify callback:', error);
    return NextResponse.json({ 
      error: 'Failed to complete Spotify authentication' 
    }, { status: 400 });
  }
}