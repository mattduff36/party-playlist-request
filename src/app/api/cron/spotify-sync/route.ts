import { NextRequest, NextResponse } from 'next/server';
import { tickAllActiveParties } from '@/lib/spotify-sync';

/**
 * Vercel Cron safety floor — once per minute.
 * Primary freshness still comes from display/admin staleness heartbeats (~5s).
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 */
export async function GET(req: NextRequest) {
  if (process.env.SPOTIFY_MOCK === 'true') {
    return NextResponse.json({ success: true, mocked: true });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('Authorization') || '';
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production' && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await tickAllActiveParties();
    return NextResponse.json({
      success: true,
      checked: result.checked,
      broadcastCount: result.broadcastCount,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron spotify-sync failed:', error);
    return NextResponse.json({ error: 'Sync tick failed' }, { status: 500 });
  }
}
