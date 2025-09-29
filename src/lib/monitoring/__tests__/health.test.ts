/**
 * Tests for Health Check System
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { healthCheckSystem, HealthCheck } from '../health';

// Mock external dependencies
jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn().mockResolvedValue({ rows: [{ test: 1 }] }),
  },
}));

jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('test'),
    del: jest.fn().mockResolvedValue(1),
  })),
}));

jest.mock('@/lib/vercel-kv', () => ({
  getVercelKVClient: jest.fn(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('test'),
    del: jest.fn().mockResolvedValue(1),
  })),
}));

jest.mock('@/lib/pusher', () => ({
  pusher: {
    appId: 'test-app-id',
    key: 'test-key',
    secret: 'test-secret',
  },
}));

describe('HealthCheckSystem', () => {
  beforeEach(() => {
    // Stop any running checks
    healthCheckSystem.stopAutomaticChecks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    healthCheckSystem.stopAutomaticChecks();
  });

  describe('Health Check Management', () => {
    it('should add custom health checks', async () => {
      const testCheck = jest.fn().mockResolvedValue({
        name: 'custom_test',
        status: 'healthy' as const,
        message: 'Custom test passed',
        timestamp: Date.now(),
      });

      healthCheckSystem.addCheck('custom_test', testCheck);
      
      const health = await healthCheckSystem.runAllChecks();
      const customCheck = health.checks.find(c => c.name === 'custom_test');
      
      expect(customCheck).toBeDefined();
      expect(customCheck?.status).toBe('healthy');
      expect(testCheck).toHaveBeenCalled();
    });

    it('should remove health checks', async () => {
      const testCheck = jest.fn().mockResolvedValue({
        name: 'removable_test',
        status: 'healthy' as const,
        message: 'Test check',
        timestamp: Date.now(),
      });

      healthCheckSystem.addCheck('removable_test', testCheck);
      healthCheckSystem.removeCheck('removable_test');
      
      const health = await healthCheckSystem.runAllChecks();
      const removedCheck = health.checks.find(c => c.name === 'removable_test');
      
      expect(removedCheck).toBeUndefined();
    });
  });

  describe('Health Check Execution', () => {
    it('should run all health checks', async () => {
      const health = await healthCheckSystem.runAllChecks();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('summary');
      expect(Array.isArray(health.checks)).toBe(true);
    });

    it('should handle check failures gracefully', async () => {
      const failingCheck = jest.fn().mockRejectedValue(new Error('Check failed'));
      
      healthCheckSystem.addCheck('failing_test', failingCheck);
      
      const health = await healthCheckSystem.runAllChecks();
      const failedCheck = health.checks.find(c => c.name === 'failing_test');
      
      expect(failedCheck).toBeDefined();
      expect(failedCheck?.status).toBe('unhealthy');
      expect(failedCheck?.message).toContain('Check failed');
    });

    it('should calculate summary correctly', async () => {
      const health = await healthCheckSystem.runAllChecks();
      
      expect(health.summary).toHaveProperty('total');
      expect(health.summary).toHaveProperty('healthy');
      expect(health.summary).toHaveProperty('degraded');
      expect(health.summary).toHaveProperty('unhealthy');
      
      expect(health.summary.total).toBe(health.checks.length);
      expect(health.summary.healthy + health.summary.degraded + health.summary.unhealthy)
        .toBe(health.summary.total);
    });

    it('should determine overall status correctly', async () => {
      // Test with all healthy checks
      const allHealthyCheck = jest.fn().mockResolvedValue({
        name: 'all_healthy',
        status: 'healthy' as const,
        message: 'All healthy',
        timestamp: Date.now(),
      });

      healthCheckSystem.addCheck('all_healthy', allHealthyCheck);
      
      let health = await healthCheckSystem.runAllChecks();
      expect(health.overall).toBe('healthy');

      // Test with degraded check
      const degradedCheck = jest.fn().mockResolvedValue({
        name: 'degraded',
        status: 'degraded' as const,
        message: 'Degraded',
        timestamp: Date.now(),
      });

      healthCheckSystem.addCheck('degraded', degradedCheck);
      
      health = await healthCheckSystem.runAllChecks();
      expect(health.overall).toBe('degraded');

      // Test with unhealthy check
      const unhealthyCheck = jest.fn().mockResolvedValue({
        name: 'unhealthy',
        status: 'unhealthy' as const,
        message: 'Unhealthy',
        timestamp: Date.now(),
      });

      healthCheckSystem.addCheck('unhealthy', unhealthyCheck);
      
      health = await healthCheckSystem.runAllChecks();
      expect(health.overall).toBe('unhealthy');
    });
  });

  describe('Component Health', () => {
    it('should check database health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const dbCheck = health.checks.find(c => c.name === 'database');
      
      expect(dbCheck).toBeDefined();
      expect(dbCheck?.status).toBe('healthy');
      expect(dbCheck?.message).toContain('Database connection successful');
    });

    it('should check Redis health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const redisCheck = health.checks.find(c => c.name === 'redis');
      
      expect(redisCheck).toBeDefined();
      expect(redisCheck?.status).toBe('healthy');
      expect(redisCheck?.message).toContain('Redis connection successful');
    });

    it('should check Vercel KV health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const kvCheck = health.checks.find(c => c.name === 'vercel_kv');
      
      expect(kvCheck).toBeDefined();
      expect(kvCheck?.status).toBe('healthy');
      expect(kvCheck?.message).toContain('Vercel KV connection successful');
    });

    it('should check Pusher health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const pusherCheck = health.checks.find(c => c.name === 'pusher');
      
      expect(pusherCheck).toBeDefined();
      expect(pusherCheck?.status).toBe('healthy');
      expect(pusherCheck?.message).toContain('Pusher configuration valid');
    });

    it('should check memory health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const memoryCheck = health.checks.find(c => c.name === 'memory');
      
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck?.status).toBe('healthy');
      expect(memoryCheck?.message).toContain('Memory usage');
      expect(memoryCheck?.details).toHaveProperty('heapUsed');
      expect(memoryCheck?.details).toHaveProperty('usagePercent');
    });

    it('should check event loop health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const eventLoopCheck = health.checks.find(c => c.name === 'event_loop');
      
      expect(eventLoopCheck).toBeDefined();
      expect(eventLoopCheck?.status).toBe('healthy');
      expect(eventLoopCheck?.message).toContain('Event loop lag');
      expect(eventLoopCheck?.details).toHaveProperty('lagMs');
    });

    it('should check application state', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const appStateCheck = health.checks.find(c => c.name === 'application_state');
      
      expect(appStateCheck).toBeDefined();
      expect(appStateCheck?.status).toBe('healthy');
      expect(appStateCheck?.message).toContain('All critical components available');
    });
  });

  describe('System Status', () => {
    it('should determine if system is healthy', () => {
      // Mock last results to be healthy
      jest.spyOn(healthCheckSystem, 'getLastResults').mockReturnValue({
        overall: 'healthy',
        timestamp: Date.now(),
        checks: [],
        summary: { total: 1, healthy: 1, degraded: 0, unhealthy: 0 },
      });

      expect(healthCheckSystem.isSystemHealthy()).toBe(true);
    });

    it('should determine if system is unhealthy', () => {
      // Mock last results to be unhealthy
      jest.spyOn(healthCheckSystem, 'getLastResults').mockReturnValue({
        overall: 'unhealthy',
        timestamp: Date.now(),
        checks: [],
        summary: { total: 1, healthy: 0, degraded: 0, unhealthy: 1 },
      });

      expect(healthCheckSystem.isSystemHealthy()).toBe(false);
    });

    it('should get component health', async () => {
      const health = await healthCheckSystem.runAllChecks();
      const dbHealth = healthCheckSystem.getComponentHealth('database');
      
      expect(dbHealth).toBeDefined();
      expect(dbHealth?.name).toBe('database');
    });

    it('should return null for non-existent component', () => {
      const nonExistent = healthCheckSystem.getComponentHealth('non_existent');
      expect(nonExistent).toBeNull();
    });
  });

  describe('Health Metrics', () => {
    it('should provide health metrics', async () => {
      await healthCheckSystem.runAllChecks();
      const metrics = healthCheckSystem.getHealthMetrics();
      
      expect(metrics).toHaveProperty('overall_status');
      expect(metrics).toHaveProperty('healthy_checks');
      expect(metrics).toHaveProperty('degraded_checks');
      expect(metrics).toHaveProperty('unhealthy_checks');
      expect(metrics).toHaveProperty('total_checks');
      expect(metrics).toHaveProperty('last_check_time');
      expect(metrics).toHaveProperty('time_since_last_check');
    });
  });

  describe('Automatic Checks', () => {
    it('should start and stop automatic checks', () => {
      const startSpy = jest.spyOn(console, 'log');
      
      healthCheckSystem.startAutomaticChecks(1000);
      expect(startSpy).toHaveBeenCalledWith('🏥 Automatic health checks started');
      
      healthCheckSystem.stopAutomaticChecks();
      expect(startSpy).toHaveBeenCalledWith('🏥 Automatic health checks stopped');
      
      startSpy.mockRestore();
    });

    it('should not start automatic checks if already running', () => {
      const startSpy = jest.spyOn(console, 'log');
      
      healthCheckSystem.startAutomaticChecks(1000);
      healthCheckSystem.startAutomaticChecks(1000); // Try to start again
      
      // Should only see one start message
      expect(startSpy).toHaveBeenCalledWith('🏥 Automatic health checks started');
      expect(startSpy).toHaveBeenCalledTimes(1);
      
      startSpy.mockRestore();
    });
  });
});
