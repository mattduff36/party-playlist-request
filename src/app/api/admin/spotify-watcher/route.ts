import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  PLAYING_QUEUE_MS,
  tickUserPlayback,
} from '@/lib/spotify-sync';

/**
 * Organiser-scoped Spotify sync ticks.
 * Multi-tenant cron ticks live at GET /api/cron/spotify-sync (exact CRON_SECRET only).
 * Never trust body userId for authorization — identity comes from the session JWT.
 */
export async function POST(req: NextRequest) {
  if (process.env.SPOTIFY_MOCK === 'true') {
    return NextResponse.json({
      success: true,
      mocked: true,
      message: 'Spotify watcher skipped under SPOTIFY_MOCK',
    });
  }

  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const username = auth.user.username;
    const body = await req.json().catch(() => ({}));
    const {
      action = 'check',
      queueInterval = PLAYING_QUEUE_MS,
      force = false,
    } = body;

    if (action === 'start') {
      return NextResponse.json(
        {
          error: 'Global watcher start is disabled. Use check/tick or /api/cron/spotify-sync.',
          code: 'WATCHER_START_DISABLED',
        },
        { status: 410 }
      );
    }

    if (action === 'check' || action === 'tick') {
      const tickResult = await tickUserPlayback(userId, username, {
        force: Boolean(force),
        queueInterval,
      });

      return NextResponse.json({
        success: true,
        message: 'Spotify sync tick completed',
        action,
        checked: tickResult.skipped ? 0 : 1,
        broadcastCount: tickResult.broadcast ? 1 : 0,
        results: [tickResult],
      });
    }

    if (action === 'stop') {
      // Non-destructive: client unmount / offline must not freeze displays.
      return NextResponse.json({
        success: true,
        message: 'Spotify sync stop acknowledged (no-op; ticks are request-driven)',
      });
    }

    if (action === 'status') {
      return NextResponse.json({
        running: true,
        mode: 'request-driven',
        userId,
        lastUpdate: Date.now(),
      });
    }

    if (action === 'refresh-queue') {
      const tickResult = await tickUserPlayback(userId, username, {
        force: true,
        queueInterval: 0,
      });

      return NextResponse.json({
        success: true,
        message: `Queue refresh completed for user ${username}`,
        userId,
        broadcast: tickResult.broadcast,
        skipped: tickResult.skipped,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Spotify watcher endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to manage Spotify watcher' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (process.env.SPOTIFY_MOCK === 'true') {
    return NextResponse.json({
      success: true,
      mocked: true,
      message: 'Spotify watcher skipped under SPOTIFY_MOCK',
    });
  }

  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    return NextResponse.json({
      running: true,
      mode: 'request-driven',
      userId: auth.user.user_id,
      lastUpdate: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get watcher status' },
      { status: 500 }
    );
  }
}
