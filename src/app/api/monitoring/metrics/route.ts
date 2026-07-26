/**
 * Metrics API — superadmin only (PRD-01).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/middleware/auth';
import { metricsCollector } from '@/lib/monitoring/metrics';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    const sa = requireSuperAdmin(auth.user);
    if (!sa.authorized) {
      return sa.response!;
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const timeRange = url.searchParams.get('range') || '1h';

    let startTime: number | undefined;
    let endTime: number | undefined;

    if (timeRange === '1h') {
      startTime = Date.now() - 3600000;
    } else if (timeRange === '6h') {
      startTime = Date.now() - 21600000;
    } else if (timeRange === '24h') {
      startTime = Date.now() - 86400000;
    } else if (timeRange === '7d') {
      startTime = Date.now() - 604800000;
    }

    if (format === 'prometheus') {
      const prometheusData = metricsCollector.exportMetrics('prometheus');
      const body =
        typeof prometheusData === 'string'
          ? prometheusData
          : JSON.stringify(prometheusData);
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    if (format === 'json') {
      const currentMetrics = metricsCollector.getCurrentMetrics();
      const alertStats = metricsCollector.getAlertStats();

      return NextResponse.json({
        timestamp: Date.now(),
        timeRange,
        metrics: currentMetrics,
        alertStats,
        history: {
          responseTime: metricsCollector.getMetrics('response_time', startTime, endTime),
          memoryUsage: metricsCollector.getMetrics('memory_usage', startTime, endTime),
          errorRate: metricsCollector.getMetrics('error_rate', startTime, endTime),
          throughput: metricsCollector.getMetrics('throughput', startTime, endTime),
          dbConnections: metricsCollector.getMetrics('db_connections', startTime, endTime),
          cacheHitRate: metricsCollector.getMetrics('cache_hit_rate', startTime, endTime),
          pusherEventsPerSecond: metricsCollector.getMetrics(
            'pusher_events_per_second',
            startTime,
            endTime
          ),
          activeUsers: metricsCollector.getMetrics('active_users', startTime, endTime),
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported format. Use "json" or "prometheus"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
