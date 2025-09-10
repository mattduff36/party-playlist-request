import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';

// Handle GET request (when Spotify redirects back)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // If there's an error from Spotify
    if (error) {
      const redirectUrl = new URL('/admin/spotify-setup', req.url);
      redirectUrl.searchParams.set('error', `Spotify authentication failed: ${error}`);
      return NextResponse.redirect(redirectUrl);
    }

    // If we have the authorization code
    if (code && state) {
      const redirectUrl = new URL('/admin/spotify-setup', req.url);
      redirectUrl.searchParams.set('code', code);
      redirectUrl.searchParams.set('state', state);
      return NextResponse.redirect(redirectUrl);
    }

    // If no code or error, redirect back with error
    const redirectUrl = new URL('/admin/spotify-setup', req.url);
    redirectUrl.searchParams.set('error', 'No authorization code received from Spotify');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Error in Spotify callback:', error);
    const redirectUrl = new URL('/admin/spotify-setup', req.url);
    redirectUrl.searchParams.set('error', 'Failed to process Spotify callback');
    return NextResponse.redirect(redirectUrl);
  }
}

// Keep the POST handler for the actual token exchange
export async function POST(req: NextRequest) {
  try {
    // This requires admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

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
    console.error('Error in Spotify callback:', error);
    return NextResponse.json({ 
      error: 'Failed to complete Spotify authentication' 
    }, { status: 400 });
  }
}