import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { storeOAuthSession, cleanupExpiredOAuthSessions } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    console.log('🎵 [spotify/auth] Endpoint called');
    
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      console.log('❌ [spotify/auth] Authentication failed');
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`✅ [spotify/auth] User ${auth.user.username} (${userId}) requesting Spotify auth`);
    
    console.log('🔗 [spotify/auth] Generating Spotify authorization URL...');
    const authData = spotifyService.getAuthorizationURL();
    
    console.log('✅ [spotify/auth] Spotify auth URL generated:', { 
      hasUrl: !!authData.url, 
      urlLength: authData.url?.length,
      hasState: !!authData.state 
    });
    
    // Store OAuth session server-side with user info for callback redirect
    try {
      await storeOAuthSession(authData.state, authData.codeVerifier, userId, auth.user.username);
      console.log('💾 [spotify/auth] OAuth session stored for user:', auth.user.username);
      
      // Clean up expired sessions while we're here
      await cleanupExpiredOAuthSessions();
    } catch (dbError) {
      console.log('⚠️ [spotify/auth] Failed to store OAuth session server-side (will rely on localStorage):', (dbError as Error).message);
      // Continue without server-side storage - localStorage will be the only option
    }
    
    return NextResponse.json({
      auth_url: authData.url,
      state: authData.state,
      code_challenge: authData.codeChallenge,
      code_verifier: authData.codeVerifier // Still return for client-side backup
    });

  } catch (error) {
    console.error('❌ [spotify/auth] Error in Spotify auth endpoint:', error);
    
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'Please log in to continue'
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to start Spotify authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}