import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { clearSpotifyAuth, clearOAuthSessionsForUser } from '@/lib/db';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';
import {
  assertUserDemoDoesNotTouchSpotify,
  isDemoModeBlockedError,
} from '@/lib/beta/demo-mode';

async function handleDisconnect(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;

    try {
      await assertUserDemoDoesNotTouchSpotify(userId, 'spotify_disconnect');
    } catch (demoErr) {
      if (isDemoModeBlockedError(demoErr)) {
        return NextResponse.json(
          {
            error: 'Demo mode active',
            code: 'DEMO_MODE_BLOCKED',
            message:
              'Spotify disconnect is disabled while interactive demo mode is on. Disable demo mode first.',
          },
          { status: 403 }
        );
      }
      throw demoErr;
    }

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
    if (isDemoModeBlockedError(error)) {
      return NextResponse.json(
        {
          error: 'Demo mode active',
          code: 'DEMO_MODE_BLOCKED',
          message:
            'Spotify disconnect is disabled while interactive demo mode is on.',
        },
        { status: 403 }
      );
    }
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
