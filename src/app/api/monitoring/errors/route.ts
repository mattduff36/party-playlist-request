/**
 * Error Reporting API (bounded public intake — PRD-01)
 *
 * Accepts validated client error reports from ErrorBoundary.
 * Does not expose operational history; durable history is superadmin-only.
 * Shares per-IP rate limit with /api/support/client-error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/metrics';
import { alertingSystem } from '@/lib/monitoring/alerts';
import { logError } from '@/lib/support/logger';
import { getIpHash } from '@/lib/support/withApiLogging';
import {
  CLIENT_ERROR_MAX_BODY_BYTES,
  isClientErrorRateLimited,
  parseClientErrorIntake,
} from '@/lib/support/client-error-intake';

export async function POST(request: NextRequest) {
  try {
    let ipHash: string;
    try {
      ipHash = getIpHash(request);
    } catch {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    if (isClientErrorRateLimited(ipHash)) {
      return NextResponse.json({ error: 'Too many error reports' }, { status: 429 });
    }

    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > CLIENT_ERROR_MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 400 });
    }

    const rawBody = await request.text();
    const parsed = parseClientErrorIntake(rawBody, request.headers.get('referer'));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { data } = parsed;
    if (!data.errorId || !data.message) {
      return NextResponse.json(
        { error: 'Missing required error data' },
        { status: 400 }
      );
    }

    await logError({
      level: data.level,
      source: 'client',
      classification: data.classification,
      message: data.message,
      stack: data.stack,
      route: data.route,
      method: 'CLIENT',
      ipHash,
      userAgent: data.userAgent || request.headers.get('user-agent'),
      meta: { errorId: data.errorId, clientLevel: data.level },
    });

    metricsCollector.recordMetric({
      name: 'error_count',
      value: 1,
      timestamp: Date.now(),
      tags: {
        level: data.level,
        type: 'error_boundary',
      },
      metadata: {
        errorId: data.errorId,
        message: data.message,
      },
    });

    if (data.level === 'fatal') {
      await alertingSystem.sendAlert({
        id: data.errorId,
        severity: 'high',
        message: `Critical Error: ${data.message}`,
        metric: 'error_count',
        value: 1,
        threshold: 0,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      errorId: data.errorId,
    });
  } catch (error) {
    console.error('❌ Error reporting failed:', error);
    return NextResponse.json(
      { error: 'Failed to report error' },
      { status: 500 }
    );
  }
}
