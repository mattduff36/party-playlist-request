/**
 * Health Check System
 *
 * Probes required runtime dependencies and reports optional / unconfigured
 * services as skipped so they do not fail the overall rollup.
 */

import {
  shouldAutoStartRuntimeServices,
  startupLog,
} from '@/lib/logging/startup';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'skipped';
  message: string;
  timestamp: number;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  skipped: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheck[];
  summary: HealthSummary;
}

function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function isPusherConfigured(): boolean {
  const appId = process.env.PUSHER_APP_ID?.trim();
  const key = process.env.PUSHER_KEY?.trim();
  const secret = process.env.PUSHER_SECRET?.trim();
  if (!appId || !key || !secret) return false;
  // Module falls back to placeholder values when env is missing
  if (appId === 'fallback-app-id' || key === 'fallback-key' || secret === 'fallback-secret') {
    return false;
  }
  return true;
}

function isVercelKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim()
  );
}

class HealthCheckSystem {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastResults: Map<string, HealthCheck> = new Map();

  constructor() {
    this.initializeDefaultChecks();
  }

  /**
   * Add a custom health check
   */
  addCheck(name: string, checkFunction: () => Promise<HealthCheck>) {
    this.checks.set(name, checkFunction);
    startupLog(`🏥 Health check added: ${name}`);
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string) {
    this.checks.delete(name);
    this.lastResults.delete(name);
    startupLog(`🏥 Health check removed: ${name}`);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const checkPromises: Promise<HealthCheck>[] = [];

    for (const [name, checkFunction] of this.checks) {
      checkPromises.push(this.runSingleCheck(name, checkFunction));
    }

    const results = await Promise.allSettled(checkPromises);
    const checks: HealthCheck[] = [];
    const checkNames = Array.from(this.checks.keys());

    results.forEach((result, index) => {
      const checkName = checkNames[index];

      if (result.status === 'fulfilled') {
        checks.push(result.value);
        this.lastResults.set(checkName, result.value);
      } else {
        const errorCheck: HealthCheck = {
          name: checkName,
          status: 'unhealthy',
          message: `Check failed: ${result.reason}`,
          timestamp: Date.now(),
        };
        checks.push(errorCheck);
        this.lastResults.set(checkName, errorCheck);
      }
    });

    const summary = this.calculateSummary(checks);
    const overall = this.determineOverallStatus(summary);

    return {
      overall,
      timestamp: Date.now(),
      checks,
      summary,
    };
  }

  /**
   * Get the last health check results
   */
  getLastResults(): SystemHealth {
    const checks = Array.from(this.lastResults.values());
    const summary = this.calculateSummary(checks);
    const overall = this.determineOverallStatus(summary);

    return {
      overall,
      timestamp: Date.now(),
      checks,
      summary,
    };
  }

  /**
   * Start automatic health checking
   */
  startAutomaticChecks(intervalMs: number = 60000) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.checkInterval = setInterval(async () => {
      await this.runAllChecks();
    }, intervalMs);

    startupLog('🏥 Automatic health checks started');
  }

  /**
   * Stop automatic health checking
   */
  stopAutomaticChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    startupLog('🏥 Automatic health checks stopped');
  }

  /**
   * Get health status for a specific component
   */
  getComponentHealth(componentName: string): HealthCheck | null {
    return this.lastResults.get(componentName) || null;
  }

  /**
   * Check if the system is healthy
   */
  isSystemHealthy(): boolean {
    const health = this.getLastResults();
    return health.overall === 'healthy';
  }

  /**
   * Get health metrics for monitoring
   */
  getHealthMetrics() {
    const health = this.getLastResults();
    const now = Date.now();

    return {
      overall_status: health.overall,
      healthy_checks: health.summary.healthy,
      degraded_checks: health.summary.degraded,
      unhealthy_checks: health.summary.unhealthy,
      skipped_checks: health.summary.skipped,
      total_checks: health.summary.total,
      last_check_time: health.timestamp,
      time_since_last_check: now - health.timestamp,
    };
  }

  private async runSingleCheck(
    name: string,
    checkFunction: () => Promise<HealthCheck>
  ): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const result = await checkFunction();
      result.responseTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: `Check failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  private calculateSummary(checks: HealthCheck[]): HealthSummary {
    return {
      total: checks.length,
      healthy: checks.filter((c) => c.status === 'healthy').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
      skipped: checks.filter((c) => c.status === 'skipped').length,
    };
  }

  /**
   * Overall status ignores skipped checks (optional / not configured).
   */
  private determineOverallStatus(
    summary: HealthSummary
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (summary.unhealthy > 0) return 'unhealthy';
    if (summary.degraded > 0) return 'degraded';
    return 'healthy';
  }

  private initializeDefaultChecks() {
    // Database — required when DATABASE_URL is set (core dependency)
    this.addCheck('database', async () => {
      if (!process.env.DATABASE_URL?.trim()) {
        return {
          name: 'database',
          status: 'skipped',
          message: 'Not configured (DATABASE_URL missing)',
          timestamp: Date.now(),
          details: { configured: false },
        };
      }

      try {
        const { getPool } = await import('@/lib/db');
        const startTime = Date.now();
        const pool = getPool();
        await pool.query('SELECT 1 AS test');
        const responseTime = Date.now() - startTime;

        return {
          name: 'database',
          status: responseTime < 1000 ? 'healthy' : 'degraded',
          message: `Database connection successful (${responseTime}ms)`,
          timestamp: Date.now(),
          responseTime,
          details: {
            responseTime,
            connectionPool: 'active',
          },
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });

    // Redis / Upstash — optional
    this.addCheck('redis', async () => {
      if (!isRedisConfigured()) {
        return {
          name: 'redis',
          status: 'skipped',
          message: 'Not configured (UPSTASH_REDIS_REST_URL / TOKEN missing)',
          timestamp: Date.now(),
          details: { configured: false },
        };
      }

      try {
        const { getRedisClient, initializeRedis } = await import('@/lib/redis');
        const startTime = Date.now();
        await initializeRedis();
        const redis = getRedisClient();

        if (!redis.isReady()) {
          return {
            name: 'redis',
            status: 'unhealthy',
            message: 'Redis is configured but not ready',
            timestamp: Date.now(),
            responseTime: Date.now() - startTime,
            details: { configured: true, ready: false },
          };
        }

        const writeOk = await redis.set('health_check', 'test', 10);
        const value = await redis.get<string>('health_check');
        await redis.del('health_check');
        const responseTime = Date.now() - startTime;

        if (!writeOk || value !== 'test') {
          return {
            name: 'redis',
            status: 'unhealthy',
            message: 'Redis read/write test failed',
            timestamp: Date.now(),
            responseTime,
            details: { configured: true, writeOk, value },
          };
        }

        return {
          name: 'redis',
          status: responseTime < 500 ? 'healthy' : 'degraded',
          message: `Redis connection successful (${responseTime}ms)`,
          timestamp: Date.now(),
          responseTime,
          details: {
            responseTime,
            readWriteTest: 'passed',
          },
        };
      } catch (error) {
        return {
          name: 'redis',
          status: 'unhealthy',
          message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });

    // Vercel KV — retired / optional; only probe if KV env is present
    this.addCheck('vercel_kv', async () => {
      if (!isVercelKvConfigured()) {
        return {
          name: 'vercel_kv',
          status: 'skipped',
          message: 'Not configured (Vercel KV retired; use Redis or DB when needed)',
          timestamp: Date.now(),
          details: { configured: false },
        };
      }

      try {
        const { getCacheClient } = await import('@/lib/cache');
        const cache = getCacheClient();
        const startTime = Date.now();

        await cache.set('health_check', 'test', 10);
        const value = await cache.get('health_check');
        await cache.delete('health_check');
        const responseTime = Date.now() - startTime;

        if (value !== 'test') {
          return {
            name: 'vercel_kv',
            status: 'unhealthy',
            message: 'Cache read/write test failed',
            timestamp: Date.now(),
            responseTime,
          };
        }

        return {
          name: 'vercel_kv',
          status: responseTime < 1000 ? 'healthy' : 'degraded',
          message: `Cache connection successful (${responseTime}ms)`,
          timestamp: Date.now(),
          responseTime,
          details: {
            responseTime,
            readWriteTest: 'passed',
            backend: 'database_cache',
          },
        };
      } catch (error) {
        return {
          name: 'vercel_kv',
          status: 'unhealthy',
          message: `Cache connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });

    // Pusher — optional realtime
    this.addCheck('pusher', async () => {
      if (!isPusherConfigured()) {
        return {
          name: 'pusher',
          status: 'skipped',
          message: 'Not configured (PUSHER_APP_ID / KEY / SECRET missing)',
          timestamp: Date.now(),
          details: { configured: false },
        };
      }

      try {
        const { pusherServer } = await import('@/lib/pusher');
        const startTime = Date.now();

        if (!pusherServer) {
          return {
            name: 'pusher',
            status: 'unhealthy',
            message: 'Pusher client failed to initialize',
            timestamp: Date.now(),
            responseTime: Date.now() - startTime,
            details: { configured: true },
          };
        }

        return {
          name: 'pusher',
          status: 'healthy',
          message: 'Pusher configuration valid',
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
          details: {
            configured: true,
            cluster: process.env.PUSHER_CLUSTER || 'us2',
          },
        };
      } catch (error) {
        return {
          name: 'pusher',
          status: 'unhealthy',
          message: `Pusher check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });

    // Memory — absolute heap thresholds (heapUsed/heapTotal is meaningless on V8/serverless)
    this.addCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const rssMB = memoryUsage.rss / 1024 / 1024;

      // Absolute MB thresholds suitable for Node serverless / small heaps
      const HEAP_DEGRADED_MB = 256;
      const HEAP_UNHEALTHY_MB = 512;
      const RSS_DEGRADED_MB = 768;
      const RSS_UNHEALTHY_MB = 1024;

      let status: HealthCheck['status'] = 'healthy';
      let message = `Memory usage: ${heapUsedMB.toFixed(2)}MB heap, ${rssMB.toFixed(2)}MB RSS`;

      if (heapUsedMB > HEAP_UNHEALTHY_MB || rssMB > RSS_UNHEALTHY_MB) {
        status = 'unhealthy';
        message += ' - CRITICAL: absolute memory threshold exceeded';
      } else if (heapUsedMB > HEAP_DEGRADED_MB || rssMB > RSS_DEGRADED_MB) {
        status = 'degraded';
        message += ' - WARNING: elevated memory usage';
      }

      return {
        name: 'memory',
        status,
        message,
        timestamp: Date.now(),
        details: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          heapUsedMB,
          heapTotalMB,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
          rssMB,
          note: 'Uses absolute MB thresholds; heapUsed/heapTotal ratio is not used',
        },
      };
    });

    // Event loop lag
    this.addCheck('event_loop', async () => {
      return new Promise((resolve) => {
        const start = process.hrtime.bigint();

        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1000000; // ms

          let status: HealthCheck['status'] = 'healthy';
          let message = `Event loop lag: ${lag.toFixed(2)}ms`;

          if (lag > 100) {
            status = 'unhealthy';
            message += ' - CRITICAL: Event loop lag over 100ms';
          } else if (lag > 50) {
            status = 'degraded';
            message += ' - WARNING: Event loop lag over 50ms';
          }

          resolve({
            name: 'event_loop',
            status,
            message,
            timestamp: Date.now(),
            details: {
              lagMs: lag,
            },
          });
        });
      });
    });

    // Application modules — static import() paths (bundler-resolvable; server-safe only)
    this.addCheck('application_state', async () => {
      const components: Array<{ id: string; load: () => Promise<unknown> }> = [
        { id: '@/lib/db', load: () => import('@/lib/db') },
        { id: '@/lib/pusher/events', load: () => import('@/lib/pusher/events') },
        { id: '@/lib/event-service', load: () => import('@/lib/event-service') },
      ];

      const missingComponents: string[] = [];

      for (const component of components) {
        try {
          await component.load();
        } catch {
          missingComponents.push(component.id);
        }
      }

      if (missingComponents.length > 0) {
        return {
          name: 'application_state',
          status: 'unhealthy',
          message: `Missing critical components: ${missingComponents.join(', ')}`,
          timestamp: Date.now(),
          details: {
            missingComponents,
          },
        };
      }

      return {
        name: 'application_state',
        status: 'healthy',
        message: 'All critical components available',
        timestamp: Date.now(),
        details: {
          componentsChecked: components.length,
          allComponentsAvailable: true,
        },
      };
    });
  }
}

// Singleton instance
export const healthCheckSystem = new HealthCheckSystem();

// Auto-start health checks in production runtime (not during `next build`)
if (shouldAutoStartRuntimeServices()) {
  healthCheckSystem.startAutomaticChecks(60000); // Check every minute
}
