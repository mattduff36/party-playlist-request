import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  PLAYING_QUEUE_MS,
  tickAllActiveParties,
  tickUserPlayback,
} from '@/lib/spotify-sync';

function isSystemOrCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const startupToken = process.env.SYSTEM_STARTUP_TOKEN || 'startup-system-token';

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  if (
    authHeader.includes('startup-system-token') ||
    (startupToken && authHeader.includes(startupToken))
  ) {
    return true;
  }
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured
  const vercelCron = req.headers.get('x-vercel-cron');
  if (vercelCron === '1' && cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }
  return false;
}

async function authorizeWatcher(req: NextRequest): Promise<
  | { ok: true; userId?: string; username?: string; isSystem: boolean }
  | { ok: false; response: NextResponse }
> {
  if (isSystemOrCronAuth(req)) {
    return { ok: true, isSystem: true };
  }
  const auth = requireAuth(req);
  if (!auth.authenticated || !auth.user) {
    return { ok: false, response: auth.response! };
  }
  return {
    ok: true,
    isSystem: false,
    userId: auth.user.user_id,
    username: auth.user.username,
  };
}

/**
 * Request-driven Spotify sync.
 * Durable ticks are driven by display/admin heartbeats + cron — not process-local setTimeout.
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
    const gate = await authorizeWatcher(req);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const {
      action = 'check',
      queueInterval = PLAYING_QUEUE_MS,
      userId,
      force = false,
    } = body;

    if (action === 'start' || action === 'check' || action === 'tick') {
      // One-shot durable tick. No process-local setTimeout chain (Vercel-safe).
      // Admin sessions tick their own party; system/cron may tick all or a given userId.
      const targetUserId = userId || (!gate.isSystem ? gate.userId : undefined);
      let result;
      if (targetUserId) {
        let username = gate.username || 'unknown';
        if (!gate.username || userId) {
          const { sql } = await import('@/lib/db/neon-client');
          const userResult =
            await sql`SELECT username FROM users WHERE id = ${targetUserId}`;
          username = userResult[0]?.username || username;
        }
        const tickResult = await tickUserPlayback(targetUserId, username, {
          force: Boolean(force),
          queueInterval,
        });
        result = {
          results: [tickResult],
          checked: tickResult.skipped ? 0 : 1,
          broadcastCount: tickResult.broadcast ? 1 : 0,
        };
      } else {
        result = await tickAllActiveParties({
          force: Boolean(force),
          queueInterval,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Spotify sync tick completed',
        action,
        checked: result.checked,
        broadcastCount: result.broadcastCount,
        results: result.results,
      });
    }

    if (action === 'stop') {
      // Non-destructive: client unmount must not freeze displays / other parties.
      return NextResponse.json({
        success: true,
        message: 'Spotify sync stop acknowledged (no-op; ticks are request-driven)',
      });
    }

    if (action === 'status') {
      return NextResponse.json({
        running: true,
        mode: 'request-driven',
        lastUpdate: Date.now(),
      });
    }

    if (action === 'refresh-queue') {
      if (!userId) {
        return NextResponse.json(
          { error: 'userId required for queue refresh' },
          { status: 400 }
        );
      }

      const { sql } = await import('@/lib/db/neon-client');
      const userResult = await sql`SELECT username FROM users WHERE id = ${userId}`;
      const username = userResult[0]?.username || 'unknown';

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
    const gate = await authorizeWatcher(req);
    if (!gate.ok) return gate.response;

    // Cron / health: run a multi-tenant tick
    const { searchParams } = new URL(req.url);
    if (searchParams.get('tick') === '1' || isSystemOrCronAuth(req)) {
      const result = await tickAllActiveParties();
      return NextResponse.json({
        success: true,
        mode: 'request-driven',
        checked: result.checked,
        broadcastCount: result.broadcastCount,
        lastUpdate: Date.now(),
      });
    }

    return NextResponse.json({
      running: true,
      mode: 'request-driven',
      lastUpdate: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get watcher status' },
      { status: 500 }
    );
  }
}
