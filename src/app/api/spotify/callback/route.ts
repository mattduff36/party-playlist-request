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
    console.log('🔐 Callback auth check:', {
      hasAuthHeader: !!authHeader,
      authHeaderStart: authHeader?.substring(0, 20) + '...',
      authHeaderLength: authHeader?.length
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Spotify callback: No authorization header provided');
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to the admin panel first.',
        redirect: '/admin',
        message: 'To connect Spotify, please go to the admin panel and use the "🎵 Spotify Setup" link.'
      }, { status: 401 });
    }

    // Validate the admin token properly
    try {
      const { authService } = await import('@/lib/auth');
      const adminPayload = await authService.requireAdminAuth(req);
      console.log('✅ Admin authentication successful:', { 
        adminId: adminPayload.adminId, 
        username: adminPayload.username 
      });
    } catch (authError) {
      console.error('❌ Admin authentication failed:', authError.message);
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to the admin panel first.',
        redirect: '/admin',
        message: 'To connect Spotify, please go to the admin panel and use the "🎵 Spotify Setup" link.'
      }, { status: 401 });
    }

    const body = await req.json();
    const { code, state, code_verifier } = body;
    
    console.log('Spotify callback POST data:', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasCodeVerifier: !!code_verifier 
    });
    
    if (!code || !code_verifier) {
      console.error('Spotify callback: Missing code or code_verifier', { 
        hasCode: !!code, 
        hasCodeVerifier: !!code_verifier 
      });
      return NextResponse.json({ 
        error: 'Authorization code and code verifier are required' 
      }, { status: 400 });
    }

    console.log('Attempting to exchange code for token...');
    const tokenData = await spotifyService.exchangeCodeForToken(code, code_verifier);
    console.log('Token exchange successful, token data:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    });
    
    // CRITICAL: Check if tokens were actually saved to database
    console.log('🔍 CRITICAL DEBUG: Checking if tokens were saved...');
    try {
      const { getSpotifyAuth } = await import('@/lib/db');
      const savedAuth = await getSpotifyAuth();
      console.log('🔍 Database check after token save:', {
        authExists: !!savedAuth,
        hasAccessToken: !!(savedAuth?.access_token),
        hasRefreshToken: !!(savedAuth?.refresh_token),
        expiresAt: savedAuth?.expires_at,
        isExpired: savedAuth?.expires_at ? new Date(savedAuth.expires_at) < new Date() : 'no-expiry-date'
      });
    } catch (dbError) {
      console.error('🚨 CRITICAL: Failed to check database after token save:', dbError);
    }
    
    // Verify tokens were saved by checking immediately
    try {
      const isNowConnected = await spotifyService.isConnected();
      console.log('Post-save connection check:', isNowConnected);
    } catch (verifyError) {
      console.log('Failed to verify connection after save:', verifyError.message);
    }
    
    // Clean up OAuth session after successful token exchange
    if (state) {
      try {
        const { clearOAuthSession } = await import('@/lib/db');
        await clearOAuthSession(state);
        console.log('OAuth session cleaned up for state:', state);
      } catch (cleanupError) {
        console.log('Failed to cleanup OAuth session (non-critical):', cleanupError);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Spotify authentication successful',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope
    });

  } catch (error) {
    console.error('Error in Spotify callback:', error);
    
    // Return more specific error message
    let errorMessage = 'Failed to complete Spotify authentication';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 400 });
  }
}