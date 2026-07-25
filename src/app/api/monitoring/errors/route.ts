/**
 * Error Reporting API
 * 
 * This endpoint handles error reports from the error boundary system
 * and integrates with the monitoring system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/metrics';
import { alertingSystem } from '@/lib/monitoring/alerts';
import { logError } from '@/lib/support/logger';
import { getIpHash } from '@/lib/support/withApiLogging';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Validate error data
    if (!errorData.errorId || !errorData.message) {
      return NextResponse.json(
        { error: 'Missing required error data' },
        { status: 400 }
      );
    }

    // Persist to support system (durable)
    await logError({
      level:
        errorData.level === 'critical' || errorData.level === 'page'
          ? 'fatal'
          : 'error',
      source: 'client',
      message: String(errorData.message),
      stack: errorData.stack || errorData.componentStack || null,
      route: errorData.url || null,
      method: 'CLIENT',
      ipHash: getIpHash(request),
      userAgent: errorData.userAgent || request.headers.get('user-agent'),
      meta: { errorId: errorData.errorId, clientLevel: errorData.level },
    });

    // Record error metrics
    metricsCollector.recordMetric({
      name: 'error_count',
      value: 1,
      timestamp: Date.now(),
      tags: {
        level: errorData.level || 'component',
        type: 'error_boundary',
      },
      metadata: {
        errorId: errorData.errorId,
        message: errorData.message,
        componentStack: errorData.componentStack,
        userAgent: errorData.userAgent,
        url: errorData.url,
      },
    });

    // Create alert for critical errors
    if (errorData.level === 'critical' || errorData.level === 'page') {
      const alert = {
        id: errorData.errorId,
        severity: 'high' as const,
        message: `Critical Error: ${errorData.message}`,
        metric: 'error_count',
        value: 1,
        threshold: 0,
        timestamp: Date.now(),
      };

      await alertingSystem.sendAlert(alert);
    }

    // Log error for debugging
    console.error('🚨 Error Boundary Report:', {
      errorId: errorData.errorId,
      message: errorData.message,
      level: errorData.level,
      timestamp: new Date(errorData.timestamp).toISOString(),
      url: errorData.url,
      userAgent: errorData.userAgent,
    });

    return NextResponse.json({ 
      success: true, 
      errorId: errorData.errorId 
    });
  } catch (error) {
    console.error('❌ Error reporting failed:', error);
    return NextResponse.json(
      { error: 'Failed to report error' },
      { status: 500 }
    );
  }
}

