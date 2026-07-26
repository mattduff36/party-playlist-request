import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';
import { storeOAuthSession, cleanupExpiredOAuthSessions } from '@/lib/db';
import { setOAuthBindCookie } from '@/lib/spotify/oauth-binding';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const authData = spotifyService.getAuthorizationURL();

    try {
      await storeOAuthSession(
        authData.state,
        authData.codeVerifier,
        userId,
        auth.user.username,
        'admin_spotify'
      );
      await cleanupExpiredOAuthSessions();
    } catch (dbError) {
      console.error('Failed to store Spotify OAuth transaction (redacted)');
      return NextResponse.json(
        { error: 'Failed to start Spotify authentication' },
        { status: 500 }
      );
    }

    const response = NextResponse.redirect(authData.url);
    setOAuthBindCookie(response, authData.state, userId);
    return response;
  } catch (error) {
    console.error('Error in Spotify auth endpoint (redacted)');

    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          details: 'Please log in to continue',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to start Spotify authentication' },
      { status: 500 }
    );
  }
}
