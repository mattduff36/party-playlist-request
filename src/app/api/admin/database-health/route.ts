/**
 * Database Health Check API
 * 
 * This endpoint provides comprehensive monitoring of the database connection pools
 * and overall database health status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { poolManager, dbService } from '@/lib/db';
import { PoolType } from '@/lib/db/connection-pool';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    try {
      await authService.requireAdminAuth(request);
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get comprehensive health information
    const healthCheck = await dbService.healthCheck();
    const poolStats = poolManager.getStats();
    const serviceStats = dbService.getStats();

    // Get detailed pool information
    const poolDetails: Record<string, any> = {};
    for (const poolType of Object.values(PoolType)) {
      const poolInfo = poolManager.getPoolInfo(poolType);
      const stats = poolStats.get(poolType);
      
      poolDetails[poolType] = {
        ...poolInfo,
        stats: stats || null,
      };
    }

    // Calculate overall health score
    const healthyPools = Object.values(poolDetails).filter(pool => pool.health === 'healthy').length;
    const totalPools = Object.keys(poolDetails).length;
    const healthScore = Math.round((healthyPools / totalPools) * 100);

    const response = {
      timestamp: new Date().toISOString(),
      overall: {
        healthy: healthCheck.healthy,
        healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'unhealthy',
      },
      pools: poolDetails,
      service: {
        totalQueries: serviceStats.totalQueries,
        averageQueryTime: Math.round(serviceStats.averageQueryTime),
        errorRate: Math.round(serviceStats.errorRate * 100) / 100,
        poolHealth: serviceStats.poolHealth,
      },
      recommendations: generateRecommendations(poolDetails, serviceStats),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Database health check error:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(poolDetails: Record<string, any>, serviceStats: any): string[] {
  const recommendations: string[] = [];

  // Check pool health
  const unhealthyPools = Object.entries(poolDetails).filter(([_, pool]) => pool.health !== 'healthy');
  if (unhealthyPools.length > 0) {
    recommendations.push(`Address unhealthy pools: ${unhealthyPools.map(([name]) => name).join(', ')}`);
  }

  // Check connection utilization
  for (const [poolType, pool] of Object.entries(poolDetails)) {
    const utilization = pool.totalConnections > 0 ? (pool.totalConnections - pool.idleConnections) / pool.totalConnections : 0;
    
    if (utilization > 0.8) {
      recommendations.push(`Consider increasing max connections for ${poolType} pool (${Math.round(utilization * 100)}% utilization)`);
    }
    
    if (pool.waitingClients > 0) {
      recommendations.push(`Clients waiting for connections in ${poolType} pool (${pool.waitingClients} waiting)`);
    }
  }

  // Check error rate
  if (serviceStats.errorRate > 0.05) {
    recommendations.push(`High error rate detected: ${Math.round(serviceStats.errorRate * 100)}%. Check database connectivity and query performance.`);
  }

  // Check query performance
  if (serviceStats.averageQueryTime > 1000) {
    recommendations.push(`Slow query performance detected: ${Math.round(serviceStats.averageQueryTime)}ms average. Consider query optimization.`);
  }

  // Check if no recommendations
  if (recommendations.length === 0) {
    recommendations.push('Database is performing optimally. No immediate action required.');
  }

  return recommendations;
}
