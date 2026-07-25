import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/support/logger';
import { getIpHash } from '@/lib/support/withApiLogging';

/** Simple in-memory rate limit for client error reports */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_HOUR = 30;

function isRateLimited(ipHash: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ipHash) || { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60 * 60 * 1000;
  }
  if (bucket.count >= MAX_PER_HOUR) {
    buckets.set(ipHash, bucket);
    return true;
  }
  bucket.count += 1;
  buckets.set(ipHash, bucket);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ipHash = getIpHash(req);
    if (isRateLimited(ipHash)) {
      return NextResponse.json({ error: 'Too many error reports' }, { status: 429 });
    }

    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message : 'Client error';
    const stack = typeof body.stack === 'string' ? body.stack : null;
    const route = typeof body.url === 'string' ? body.url : req.headers.get('referer');
    const level = body.level === 'fatal' || body.level === 'page' || body.level === 'critical'
      ? 'fatal'
      : 'error';

    const classification =
      body.classification === 'handled' ? 'handled' : 'unhandled';

    const id = await logError({
      level,
      source: 'client',
      classification,
      message,
      stack: stack || (typeof body.componentStack === 'string' ? body.componentStack : null),
      route,
      method: 'CLIENT',
      username: typeof body.username === 'string' ? body.username : null,
      userId: typeof body.userId === 'string' ? body.userId : null,
      ipHash,
      userAgent: req.headers.get('user-agent') || body.userAgent,
      meta: {
        errorId: body.errorId,
        clientLevel: body.level,
        handled: classification === 'handled',
      },
    });

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to record error' }, { status: 500 });
  }
}
