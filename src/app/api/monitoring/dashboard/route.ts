/**
 * Monitoring Dashboard API
 * 
 * This endpoint provides comprehensive monitoring data for the admin dashboard
 * including metrics, alerts, health checks, and system status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { metricsCollector } from '@/lib/monitoring/metrics';
import { alertingSystem } from '@/lib/monitoring/alerts';
import { healthCheckSystem } from '@/lib/monitoring/health';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    try {
      await authService.requireAdminAuth(request);
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all monitoring data
    const [metrics, health, alertStats, deliveryStats] = await Promise.all([
      getMetricsData(),
      getHealthData(),
      getAlertData(),
      getDeliveryData(),
    ]);

    const dashboard = {
      timestamp: Date.now(),
      metrics,
      health,
      alerts: alertStats,
      deliveries: deliveryStats,
      summary: {
        systemStatus: health.overall,
        activeAlerts: alertStats.unresolved,
        criticalAlerts: alertStats.critical,
        deliverySuccessRate: deliveryStats.successRate,
        uptime: calculateUptime(),
      },
    };

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('❌ Monitoring dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

async function getMetricsData() {
  const currentMetrics = metricsCollector.getCurrentMetrics();
  const metricsHistory = {
    responseTime: metricsCollector.getMetrics('response_time', Date.now() - 3600000), // Last hour
    memoryUsage: metricsCollector.getMetrics('memory_usage', Date.now() - 3600000),
    errorRate: metricsCollector.getMetrics('error_rate', Date.now() - 3600000),
    throughput: metricsCollector.getMetrics('throughput', Date.now() - 3600000),
  };

  return {
    current: currentMetrics,
    history: metricsHistory,
    trends: calculateTrends(metricsHistory),
  };
}

async function getHealthData() {
  const health = healthCheckSystem.getLastResults();
  const healthMetrics = healthCheckSystem.getHealthMetrics();

  return {
    ...health,
    metrics: healthMetrics,
  };
}

async function getAlertData() {
  const alerts = alertingSystem.getAlerts();
  const stats = alertingSystem.getAlertStats();

  return {
    ...stats,
    recent: alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10), // Last 10 alerts
  };
}

async function getDeliveryData() {
  const stats = alertingSystem.getDeliveryStats();

  return stats;
}

function calculateTrends(history: any) {
  const trends: Record<string, 'up' | 'down' | 'stable'> = {};

  Object.keys(history).forEach(metric => {
    const data = history[metric];
    if (data.length < 2) {
      trends[metric] = 'stable';
      return;
    }

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((sum: number, item: any) => sum + item.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum: number, item: any) => sum + item.value, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) {
      trends[metric] = 'up';
    } else if (change < -5) {
      trends[metric] = 'down';
    } else {
      trends[metric] = 'stable';
    }
  });

  return trends;
}

function calculateUptime(): number {
  // In a real implementation, you would track uptime from application start
  // For now, we'll return a placeholder
  return 99.9; // 99.9% uptime
}
