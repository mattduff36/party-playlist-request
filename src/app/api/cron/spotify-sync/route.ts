import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { tickAllActiveParties } from '@/lib/spotify-sync';

/**
 * Vercel Cron safety floor — once per minute.
 * Primary freshness still comes from display/admin staleness heartbeats (~5s).
 *
 * Auth (fail-closed): requires exact `Authorization: Bearer ${CRON_SECRET}`.
 * If CRON_SECRET is unset, always 401 — including production and Vercel Cron.
 * Production must set CRON_SECRET (name only; never log the value).
 */
function authorizeCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${cronSecret}`;
  const provided = Buffer.from(authHeader);
  const required = Buffer.from(expected);
  if (provided.length !== required.length) {
    return false;
  }
  return timingSafeEqual(provided, required);
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.SPOTIFY_MOCK === 'true') {
    return NextResponse.json({ success: true, mocked: true });
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
