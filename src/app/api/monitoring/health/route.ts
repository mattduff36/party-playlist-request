/**
 * Health Check API
 * 
 * This endpoint provides health check data for monitoring systems
 * and load balancers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthCheckSystem } from '@/lib/monitoring/health';

export async function GET(request: NextRequest) {
  try {
    const health = await healthCheckSystem.runAllChecks();
    
    // Return appropriate HTTP status based on health
    const status = health.overall === 'healthy' ? 200 : 
                   health.overall === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status });
  } catch (error) {
    console.error('❌ Health check error:', error);
    return NextResponse.json(
      { 
        overall: 'unhealthy',
        timestamp: Date.now(),
        checks: [],
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 1 },
        error: 'Health check failed'
      },
      { status: 503 }
    );
  }
}
