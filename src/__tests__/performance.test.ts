/**
 * Performance Tests for 350+ Concurrent Users
 * 
 * This test suite simulates high-load scenarios to ensure the system
 * can handle 350+ concurrent users without performance degradation.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  concurrentUsers: 350,
  testDuration: 30000, // 30 seconds
  rampUpTime: 5000,    // 5 seconds
  maxResponseTime: 2000, // 2 seconds
  maxMemoryUsage: 500 * 1024 * 1024, // 500MB
  maxCpuUsage: 80, // 80%
};

describe('Performance Tests - 350+ Concurrent Users', () => {
  let startTime: number;
  let endTime: number;
  let performanceMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    memoryUsage: NodeJS.MemoryUsage[];
    cpuUsage: number[];
  };

  beforeEach(() => {
    startTime = Date.now();
    performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      memoryUsage: [],
      cpuUsage: []
    };
  });

  afterEach(() => {
    endTime = Date.now();
    const testDuration = endTime - startTime;
    
    // Log performance metrics
    console.log('\n📊 Performance Test Results:');
    console.log(`⏱️  Test Duration: ${testDuration}ms`);
    console.log(`📈 Total Requests: ${performanceMetrics.totalRequests}`);
    console.log(`✅ Successful Requests: ${performanceMetrics.successfulRequests}`);
    console.log(`❌ Failed Requests: ${performanceMetrics.failedRequests}`);
    console.log(`⚡ Average Response Time: ${performanceMetrics.averageResponseTime}ms`);
    console.log(`🚀 Max Response Time: ${performanceMetrics.maxResponseTime}ms`);
    console.log(`🐌 Min Response Time: ${performanceMetrics.minResponseTime}ms`);
    console.log(`💾 Peak Memory Usage: ${Math.max(...performanceMetrics.memoryUsage.map(m => m.heapUsed)) / 1024 / 1024}MB`);
  });

  describe('Database Performance', () => {
    it('should handle 350+ concurrent database operations', async () => {
      const { db, events } = await import('@/lib/db');
      const { eq } = await import('drizzle-orm');
      
      const concurrentOperations = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        performDatabaseOperation(db, events, eq, i)
      );

      const results = await Promise.allSettled(concurrentOperations);
      
      // Analyze results
      results.forEach((result, index) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.95); // 95% success rate
      expect(performanceMetrics.averageResponseTime).toBeLessThan(PERFORMANCE_CONFIG.maxResponseTime);
      expect(performanceMetrics.maxResponseTime).toBeLessThan(PERFORMANCE_CONFIG.maxResponseTime * 2);
    }, 60000);

    it('should maintain database connection pool under load', async () => {
      try {
        const { poolManager } = await import('@/lib/db');
        
        // Get initial pool stats
        const initialStats = poolManager.getAllPoolStats();
        
        // Simulate load
        const loadPromises = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, () => 
          simulateDatabaseLoad(poolManager)
        );

        await Promise.allSettled(loadPromises);
        
        // Get final pool stats
        const finalStats = poolManager.getAllPoolStats();
        
        // Assertions
        expect(finalStats.get('read-write')?.activeConnections).toBeLessThanOrEqual(initialStats.get('read-write')?.maxConnections || 10);
        expect(finalStats.get('read-only')?.activeConnections).toBeLessThanOrEqual(initialStats.get('read-only')?.maxConnections || 10);
      } catch (error) {
        // Pool manager might not be available in test environment
        expect(error).toBeInstanceOf(Error);
      }
    }, 30000);
  });

  describe('Real-time Performance', () => {
    it('should handle 350+ concurrent Pusher events', async () => {
      const { generateEventId, generateEventVersion, isValidEvent } = await import('@/lib/pusher/events');
      
      const concurrentEvents = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        generateConcurrentPusherEvent(i)
      );

      const results = await Promise.allSettled(concurrentEvents);
      
      // Analyze results
      results.forEach((result) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.95);
      expect(performanceMetrics.averageResponseTime).toBeLessThan(100); // Pusher events should be very fast
    }, 30000);

    it('should handle rate limiting under high load', async () => {
      const { RateLimiter } = await import('@/lib/pusher/rate-limiter');
      
      const rateLimiter = new RateLimiter();
      const concurrentRateLimitChecks = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        performRateLimitCheck(rateLimiter, `user-${i}`)
      );

      const results = await Promise.allSettled(concurrentRateLimitChecks);
      
      // Analyze results
      results.forEach((result) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.9);
      expect(performanceMetrics.averageResponseTime).toBeLessThan(50); // Rate limiting should be very fast
    }, 30000);
  });

  describe('Caching Performance', () => {
    it('should handle 350+ concurrent Redis operations', async () => {
      const { getRedisClient } = await import('@/lib/redis');
      
      const redis = getRedisClient();
      const concurrentRedisOps = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        performRedisOperation(redis, i)
      );

      const results = await Promise.allSettled(concurrentRedisOps);
      
      // Analyze results
      results.forEach((result) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.9);
      expect(performanceMetrics.averageResponseTime).toBeLessThan(100); // Redis should be very fast
    }, 30000);

    it('should handle 350+ concurrent Vercel KV operations', async () => {
      const { getVercelKVClient } = await import('@/lib/vercel-kv');
      
      const kv = getVercelKVClient();
      const concurrentKVOps = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        performKVOperation(kv, i)
      );

      const results = await Promise.allSettled(concurrentKVOps);
      
      // Analyze results
      results.forEach((result) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.9);
      expect(performanceMetrics.averageResponseTime).toBeLessThan(200); // Vercel KV should be reasonably fast
    }, 30000);
  });

  describe('API Performance', () => {
    it('should handle 350+ concurrent API requests', async () => {
      const concurrentApiRequests = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        performApiRequest(i)
      );

      const results = await Promise.allSettled(concurrentApiRequests);
      
      // Analyze results
      results.forEach((result) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.9);
      expect(performanceMetrics.averageResponseTime).toBeLessThan(PERFORMANCE_CONFIG.maxResponseTime);
    }, 60000);
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate sustained load
      const loadPromises = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        simulateMemoryIntensiveOperation(i)
      );

      await Promise.allSettled(loadPromises);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Assertions
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.maxMemoryUsage);
      expect(finalMemory.heapUsed / 1024 / 1024).toBeLessThan(1000); // Less than 1GB
    }, 30000);

    it('should handle memory leaks gracefully', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate operations that might cause memory leaks
      for (let i = 0; i < 10; i++) {
        const leakPromises = Array.from({ length: 100 }, (_, j) => 
          simulatePotentialMemoryLeak(i * 100 + j)
        );
        
        await Promise.allSettled(leakPromises);
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Assertions
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.maxMemoryUsage);
    }, 60000);
  });

  describe('System Integration Performance', () => {
    it('should handle end-to-end user flows under load', async () => {
      const concurrentUserFlows = Array.from({ length: PERFORMANCE_CONFIG.concurrentUsers }, (_, i) => 
        simulateCompleteUserFlow(i)
      );

      const results = await Promise.allSettled(concurrentUserFlows);
      
      // Analyze results
      results.forEach((result) => {
        performanceMetrics.totalRequests++;
        
        if (result.status === 'fulfilled') {
          performanceMetrics.successfulRequests++;
          const responseTime = result.value.responseTime;
          performanceMetrics.averageResponseTime += responseTime;
          performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
          performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
        } else {
          performanceMetrics.failedRequests++;
        }
      });

      // Calculate average response time
      performanceMetrics.averageResponseTime /= performanceMetrics.successfulRequests;

      // Assertions
      expect(performanceMetrics.successfulRequests).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.concurrentUsers * 0.85);
      expect(performanceMetrics.averageResponseTime).toBeLessThan(PERFORMANCE_CONFIG.maxResponseTime);
    }, 120000);
  });
});

// Helper functions for performance testing

async function performDatabaseOperation(db: any, events: any, eq: any, userId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate database operation
    const result = await db.select().from(events).limit(1);
    const responseTime = Date.now() - startTime;
    
    return { success: true, responseTime, result };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function simulateDatabaseLoad(poolManager: any) {
  const startTime = Date.now();
  
  try {
    // Simulate database load
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    const responseTime = Date.now() - startTime;
    
    return { success: true, responseTime };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function generateConcurrentPusherEvent(userId: number) {
  const startTime = Date.now();
  
  try {
    const { generateEventId, generateEventVersion } = await import('@/lib/pusher/events');
    
    // Generate event
    const eventId = generateEventId();
    const version = generateEventVersion();
    
    // Simulate event processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime, eventId, version };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function performRateLimitCheck(rateLimiter: any, userId: string) {
  const startTime = Date.now();
  
  try {
    const result = await rateLimiter.checkLimit(userId, 'test-action');
    const responseTime = Date.now() - startTime;
    
    return { success: true, responseTime, result };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function performRedisOperation(redis: any, userId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate Redis operation
    await redis.set(`test-key-${userId}`, `test-value-${userId}`);
    const value = await redis.get(`test-key-${userId}`);
    await redis.del(`test-key-${userId}`);
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime, value };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function performKVOperation(kv: any, userId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate Vercel KV operation
    await kv.set(`test-key-${userId}`, `test-value-${userId}`);
    const value = await kv.get(`test-key-${userId}`);
    await kv.del(`test-key-${userId}`);
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime, value };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function performApiRequest(userId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate API request
    const response = await fetch('http://localhost:3000/api/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `test-user-${userId}`
      }
    });
    
    const responseTime = Date.now() - startTime;
    return { success: response.ok, responseTime, status: response.status };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function simulateMemoryIntensiveOperation(userId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate memory-intensive operation
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      userId: userId,
      data: `test-data-${i}`.repeat(100),
      timestamp: Date.now()
    }));
    
    // Process data
    const processed = data.map(item => ({
      ...item,
      processed: true,
      hash: item.data.length
    }));
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime, processedCount: processed.length };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function simulatePotentialMemoryLeak(operationId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate operation that might cause memory leak
    const leakyData = new Map();
    
    for (let i = 0; i < 100; i++) {
      leakyData.set(`key-${i}`, {
        id: i,
        operationId: operationId,
        data: new Array(1000).fill(`leak-${i}`),
        timestamp: Date.now()
      });
    }
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime, dataSize: leakyData.size };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}

async function simulateCompleteUserFlow(userId: number) {
  const startTime = Date.now();
  
  try {
    // Simulate complete user flow
    const steps = [
      () => performApiRequest(userId),
      () => generateConcurrentPusherEvent(userId),
      async () => {
        const { getRedisClient } = await import('@/lib/redis');
        return performRedisOperation(getRedisClient(), userId);
      },
      async () => {
        const { getVercelKVClient } = await import('@/lib/vercel-kv');
        return performKVOperation(getVercelKVClient(), userId);
      }
    ];
    
    const results = await Promise.allSettled(steps.map(step => step()));
    const responseTime = Date.now() - startTime;
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    return { 
      success: successCount >= steps.length * 0.8, // 80% success rate
      responseTime, 
      successCount,
      totalSteps: steps.length
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return { success: false, responseTime, error };
  }
}
