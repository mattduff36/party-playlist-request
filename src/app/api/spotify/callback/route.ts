import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { resetSpotifyConnectionState } from '@/lib/spotify-connection-state';

// Handle GET request (when Spotify redirects back)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Get username from OAuth session to redirect correctly
    let username = 'admin'; // Fallback to single-tenant route
    if (state) {
      try {
        const { getOAuthSession } = await import('@/lib/db');
        const session = await getOAuthSession(state);
        if (session?.username) {
          username = session.username;
          console.log(`🔀 [spotify/callback] Redirecting to /${username}/admin/overview`);
        }
      } catch (sessionError) {
        console.error('Failed to get OAuth session for redirect:', sessionError);
      }
    }

    const baseUrl = username === 'admin' ? '/admin/overview' : `/${username}/admin/overview`;

    // If there's an error from Spotify
    if (error) {
      const redirectUrl = new URL(baseUrl, req.url);
      redirectUrl.searchParams.set('error', `Spotify authentication failed: ${error}`);
      return NextResponse.redirect(redirectUrl);
    }

    // If we have the authorization code
    if (code && state) {
      const redirectUrl = new URL(baseUrl, req.url);
      redirectUrl.searchParams.set('code', code);
      redirectUrl.searchParams.set('state', state);
      return NextResponse.redirect(redirectUrl);
    }

    // If no code or error, redirect back with error
    const redirectUrl = new URL(baseUrl, req.url);
    redirectUrl.searchParams.set('error', 'No authorization code received from Spotify');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Error in Spotify callback:', error);
    const redirectUrl = new URL('/admin/overview', req.url);
    redirectUrl.searchParams.set('error', 'Failed to process Spotify callback');
    return NextResponse.redirect(redirectUrl);
  }
}

// Keep the POST handler for the actual token exchange
export async function POST(req: NextRequest) {
  try {
    // Authenticate using JWT cookies
    const { requireAuth } = await import('@/middleware/auth');
    const auth = requireAuth(req);
    
    if (!auth.authenticated || !auth.user) {
      console.error('❌ [spotify/callback] Authentication required');
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const username = auth.user.username;
    console.log(`✅ [spotify/callback] User ${username} (${userId}) exchanging Spotify code`);

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
    let tokenData;
    try {
      tokenData = await spotifyService.exchangeCodeForToken(code, code_verifier);
      console.log('✅ Token exchange successful, token data:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      });
    } catch (tokenError) {
      console.error('❌ CRITICAL: Token exchange failed:', {
        error: tokenError.message,
        stack: tokenError.stack,
        code: code?.substring(0, 10) + '...',
        codeVerifier: code_verifier?.substring(0, 10) + '...'
      });
      throw tokenError; // Re-throw to be caught by outer catch
    }
    
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
    
    // Reset connection state - Spotify is now connected!
    resetSpotifyConnectionState();
    console.log('✅ Spotify connection state reset - ready for API calls');
    
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