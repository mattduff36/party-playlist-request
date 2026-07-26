import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { clearSpotifyAuth, clearOAuthSessionsForUser } from '@/lib/db';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';

async function handleDisconnect(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;

    await clearSpotifyAuth(userId);
    await clearOAuthSessionsForUser(userId);
    const { invalidatePlaylistCacheForUser } = await import(
      '@/lib/playlist-cache'
    );
    invalidatePlaylistCacheForUser(userId);

    reportActivity(
      req,
      'spotify.disconnect',
      `Spotify disconnected for ${auth.user.username}`,
      {
        user: auth.user,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Spotify account disconnected successfully',
    });
  } catch (error) {
    console.error('Spotify disconnect error (redacted)');
    reportApiError(req, error, { source: 'spotify' });

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
      {
        error: 'Failed to disconnect Spotify account',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleDisconnect(req);
}

export async function DELETE(req: NextRequest) {
  return handleDisconnect(req);
}
