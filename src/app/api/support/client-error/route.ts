import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/support/logger';
import { getIpHash } from '@/lib/support/withApiLogging';
import {
  CLIENT_ERROR_MAX_BODY_BYTES,
  parseClientErrorIntake,
} from '@/lib/support/client-error-intake';

/** Simple in-memory rate limit for client error reports (process-local; distributed limit is PRD-02/06). */
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

    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength > CLIENT_ERROR_MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 400 });
    }

    const rawBody = await req.text();
    const parsed = parseClientErrorIntake(
      rawBody,
      req.headers.get('referer')
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { data } = parsed;
    const id = await logError({
      level: data.level,
      source: 'client',
      classification: data.classification,
      message: data.message,
      stack: data.stack,
      route: data.route,
      method: 'CLIENT',
      username: data.username,
      userId: data.userId,
      ipHash,
      userAgent: req.headers.get('user-agent') || data.userAgent,
      meta: {
        errorId: data.errorId,
        clientLevel: data.level,
        handled: data.classification === 'handled',
      },
    });

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to record error' }, { status: 500 });
  }
}
