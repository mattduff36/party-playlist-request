import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';
import { getSpotifyAuth } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    console.log('🔍 DEBUG: Starting Spotify connection test...');
    
    // Test 1: Check raw database tokens
    let dbTokens = null;
    try {
      dbTokens = await getSpotifyAuth();
      console.log('🔍 DEBUG: Database tokens:', {
        hasAccessToken: !!dbTokens?.access_token,
        hasRefreshToken: !!dbTokens?.refresh_token,
        expiresAt: dbTokens?.expires_at,
        scope: dbTokens?.scope,
        tokenType: dbTokens?.token_type,
        updatedAt: dbTokens?.updated_at
      });
    } catch (dbError) {
      console.error('🔍 DEBUG: Database error:', dbError);
    }
    
    // Test 2: Check isConnected()
    let isConnected = false;
    try {
      isConnected = await spotifyService.isConnected();
      console.log('🔍 DEBUG: isConnected() result:', isConnected);
    } catch (connError) {
      console.error('🔍 DEBUG: isConnected() error:', connError);
    }
    
    // Test 3: Try to get access token
    let accessTokenTest = null;
    try {
      const token = await spotifyService.getAccessToken();
      accessTokenTest = {
        success: true,
        tokenLength: token?.length || 0,
        tokenStart: token?.substring(0, 10) + '...'
      };
      console.log('🔍 DEBUG: getAccessToken() success:', accessTokenTest);
    } catch (tokenError) {
      accessTokenTest = {
        success: false,
        error: tokenError.message
      };
      console.error('🔍 DEBUG: getAccessToken() error:', tokenError);
    }
    
    // Test 4: Try to get current playback
    let playbackTest = null;
    try {
      const playback = await spotifyService.getCurrentPlayback();
      playbackTest = {
        success: true,
        hasItem: !!playback?.item,
        isPlaying: playback?.is_playing,
        trackName: playback?.item?.name || null
      };
      console.log('🔍 DEBUG: getCurrentPlayback() success:', playbackTest);
    } catch (playbackError) {
      playbackTest = {
        success: false,
        error: playbackError.message
      };
      console.error('🔍 DEBUG: getCurrentPlayback() error:', playbackError);
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tests: {
        databaseTokens: dbTokens ? {
          hasAccessToken: !!dbTokens.access_token,
          hasRefreshToken: !!dbTokens.refresh_token,
          expiresAt: dbTokens.expires_at,
          scope: dbTokens.scope,
          updatedAt: dbTokens.updated_at
        } : null,
        isConnected,
        accessToken: accessTokenTest,
        playback: playbackTest
      },
      diagnosis: {
        tokensInDatabase: !!dbTokens,
        serviceConnected: isConnected,
        canGetToken: accessTokenTest?.success || false,
        canGetPlayback: playbackTest?.success || false
      }
    });
    
  } catch (error) {
    console.error('🔍 DEBUG: Test error:', error);
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
