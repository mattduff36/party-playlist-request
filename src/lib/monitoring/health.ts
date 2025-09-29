/**
 * Health Check System
 * 
 * This module provides comprehensive health checks for all system components
 * including database, cache, external services, and application state.
 */

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: number;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
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
    console.log(`🏥 Health check added: ${name}`);
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string) {
    this.checks.delete(name);
    this.lastResults.delete(name);
    console.log(`🏥 Health check removed: ${name}`);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checkPromises: Promise<HealthCheck>[] = [];

    for (const [name, checkFunction] of this.checks) {
      checkPromises.push(
        this.runSingleCheck(name, checkFunction)
      );
    }

    const results = await Promise.allSettled(checkPromises);
    const checks: HealthCheck[] = [];

    results.forEach((result, index) => {
      const checkName = Array.from(this.checks.keys())[index];
      
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

    console.log('🏥 Automatic health checks started');
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
    console.log('🏥 Automatic health checks stopped');
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
      total_checks: health.summary.total,
      last_check_time: health.timestamp,
      time_since_last_check: now - health.timestamp,
    };
  }

  private async runSingleCheck(name: string, checkFunction: () => Promise<HealthCheck>): Promise<HealthCheck> {
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

  private calculateSummary(checks: HealthCheck[]) {
    const total = checks.length;
    const healthy = checks.filter(c => c.status === 'healthy').length;
    const degraded = checks.filter(c => c.status === 'degraded').length;
    const unhealthy = checks.filter(c => c.status === 'unhealthy').length;

    return { total, healthy, degraded, unhealthy };
  }

  private determineOverallStatus(summary: { total: number; healthy: number; degraded: number; unhealthy: number }): 'healthy' | 'degraded' | 'unhealthy' {
    if (summary.unhealthy > 0) return 'unhealthy';
    if (summary.degraded > 0) return 'degraded';
    return 'healthy';
  }

  private initializeDefaultChecks() {
    // Database health check
    this.addCheck('database', async () => {
      try {
        const { db } = await import('@/lib/db');
        const startTime = Date.now();
        
        // Simple query to test database connectivity
        await db.execute('SELECT 1 as test');
        
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

    // Redis health check
    this.addCheck('redis', async () => {
      try {
        const { getRedisClient } = await import('@/lib/redis');
        const redis = getRedisClient();
        const startTime = Date.now();
        
        // Test Redis connectivity
        await redis.set('health_check', 'test', { ex: 10 });
        const value = await redis.get('health_check');
        await redis.del('health_check');
        
        const responseTime = Date.now() - startTime;
        
        if (value !== 'test') {
          return {
            name: 'redis',
            status: 'unhealthy',
            message: 'Redis read/write test failed',
            timestamp: Date.now(),
            responseTime,
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

    // Vercel KV health check
    this.addCheck('vercel_kv', async () => {
      try {
        const { getVercelKVClient } = await import('@/lib/vercel-kv');
        const kv = getVercelKVClient();
        const startTime = Date.now();
        
        // Test Vercel KV connectivity
        await kv.set('health_check', 'test', { ex: 10 });
        const value = await kv.get('health_check');
        await kv.del('health_check');
        
        const responseTime = Date.now() - startTime;
        
        if (value !== 'test') {
          return {
            name: 'vercel_kv',
            status: 'unhealthy',
            message: 'Vercel KV read/write test failed',
            timestamp: Date.now(),
            responseTime,
          };
        }
        
        return {
          name: 'vercel_kv',
          status: responseTime < 1000 ? 'healthy' : 'degraded',
          message: `Vercel KV connection successful (${responseTime}ms)`,
          timestamp: Date.now(),
          responseTime,
          details: {
            responseTime,
            readWriteTest: 'passed',
          },
        };
      } catch (error) {
        return {
          name: 'vercel_kv',
          status: 'unhealthy',
          message: `Vercel KV connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });

    // Pusher health check
    this.addCheck('pusher', async () => {
      try {
        const { pusher } = await import('@/lib/pusher');
        const startTime = Date.now();
        
        // Test Pusher configuration
        const isConfigured = pusher && pusher.appId && pusher.key && pusher.secret;
        
        const responseTime = Date.now() - startTime;
        
        if (!isConfigured) {
          return {
            name: 'pusher',
            status: 'unhealthy',
            message: 'Pusher not properly configured',
            timestamp: Date.now(),
            responseTime,
            details: {
              configured: false,
            },
          };
        }
        
        return {
          name: 'pusher',
          status: 'healthy',
          message: 'Pusher configuration valid',
          timestamp: Date.now(),
          responseTime,
          details: {
            configured: true,
            appId: pusher.appId,
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

    // Memory health check
    this.addCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory usage: ${heapUsedMB.toFixed(2)}MB (${usagePercent.toFixed(1)}%)`;
      
      if (usagePercent > 90) {
        status = 'unhealthy';
        message += ' - CRITICAL: Memory usage over 90%';
      } else if (usagePercent > 80) {
        status = 'degraded';
        message += ' - WARNING: Memory usage over 80%';
      }
      
      return {
        name: 'memory',
        status,
        message,
        timestamp: Date.now(),
        details: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
          usagePercent,
        },
      };
    });

    // Event loop lag check
    this.addCheck('event_loop', async () => {
      return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
          
          let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
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

    // Application state check
    this.addCheck('application_state', async () => {
      try {
        // Check if critical application components are available
        const components = [
          '@/lib/state/global-event-client',
          '@/lib/pusher/events',
          '@/lib/db',
        ];
        
        const missingComponents = [];
        
        for (const component of components) {
          try {
            await import(component);
          } catch (error) {
            missingComponents.push(component);
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
      } catch (error) {
        return {
          name: 'application_state',
          status: 'unhealthy',
          message: `Application state check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });
  }
}

// Singleton instance
export const healthCheckSystem = new HealthCheckSystem();

// Auto-start health checks in production
if (process.env.NODE_ENV === 'production') {
  healthCheckSystem.startAutomaticChecks(60000); // Check every minute
}
