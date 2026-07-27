import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/support/logger';
import { getIpHash } from '@/lib/support/withApiLogging';
import {
  CLIENT_ERROR_MAX_BODY_BYTES,
  isClientErrorRateLimited,
  parseClientErrorIntake,
} from '@/lib/support/client-error-intake';

export async function POST(req: NextRequest) {
  try {
    let ipHash: string;
    try {
      ipHash = getIpHash(req);
    } catch {
      // Production fail-closed when IP_SALT is missing
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    if (isClientErrorRateLimited(ipHash)) {
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
