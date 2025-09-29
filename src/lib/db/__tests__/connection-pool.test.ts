/**
 * Connection Pool Tests
 * 
 * Tests for the connection pooling system including pool management,
 * health monitoring, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConnectionPoolManager, PoolType } from '../connection-pool';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((config) => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [{ test: 'data' }] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
    on: jest.fn(),
  })),
}));

// Mock drizzle
jest.mock('drizzle-orm/pg-core', () => ({
  drizzle: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  }),
}));

// Mock schema
jest.mock('../schema', () => ({
  events: { id: 'events' },
  admins: { id: 'admins' },
  requests: { id: 'requests' },
}));

describe('ConnectionPoolManager', () => {
  let poolManager: ConnectionPoolManager;

  beforeEach(() => {
    // Set up environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.NODE_ENV = 'test';
    
    poolManager = new ConnectionPoolManager();
  });

  afterEach(async () => {
    await poolManager.closeAllPools();
  });

  describe('Pool Initialization', () => {
    it('should initialize all pool types', () => {
      for (const poolType of Object.values(PoolType)) {
        expect(() => poolManager.getPool(poolType)).not.toThrow();
        expect(() => poolManager.getDrizzle(poolType)).not.toThrow();
      }
    });

    it('should have different configurations for different pool types', () => {
      const readOnlyPool = poolManager.getPool(PoolType.READ_ONLY);
      const writeOnlyPool = poolManager.getPool(PoolType.WRITE_ONLY);
      
      expect(readOnlyPool).toBeDefined();
      expect(writeOnlyPool).toBeDefined();
      expect(readOnlyPool).not.toBe(writeOnlyPool);
    });
  });

  describe('Pool Operations', () => {
    it('should execute operations with pool', async () => {
      const result = await poolManager.executeWithPool(
        PoolType.READ_ONLY,
        async (client) => {
          const queryResult = await client.query('SELECT 1');
          return queryResult.rows[0];
        }
      );

      expect(result).toEqual({ test: 'data' });
    });

    it('should handle pool errors gracefully', async () => {
      const mockPool = poolManager.getPool(PoolType.READ_ONLY);
      const mockConnect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockPool.connect = mockConnect;

      await expect(
        poolManager.executeWithPool(PoolType.READ_ONLY, async () => 'test')
      ).rejects.toThrow('Connection failed');
    });

    it('should get connection from pool', async () => {
      const client = await poolManager.getConnection(PoolType.READ_ONLY);
      expect(client).toBeDefined();
      expect(typeof client.query).toBe('function');
      expect(typeof client.release).toBe('function');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track pool statistics', () => {
      const stats = poolManager.getStats();
      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBeGreaterThan(0);
      
      for (const [poolType, poolStats] of stats) {
        expect(poolStats).toHaveProperty('totalConnections');
        expect(poolStats).toHaveProperty('idleConnections');
        expect(poolStats).toHaveProperty('waitingClients');
        expect(poolStats).toHaveProperty('health');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(poolStats.health);
      }
    });

    it('should check pool health', () => {
      const isHealthy = poolManager.isHealthy(PoolType.READ_ONLY);
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should get pool information', () => {
      const poolInfo = poolManager.getPoolInfo(PoolType.READ_ONLY);
      expect(poolInfo).toHaveProperty('totalConnections');
      expect(poolInfo).toHaveProperty('idleConnections');
      expect(poolInfo).toHaveProperty('waitingClients');
      expect(poolInfo).toHaveProperty('health');
    });
  });

  describe('Pool Management', () => {
    it('should close individual pools', async () => {
      await poolManager.closePool(PoolType.READ_ONLY);
      
      // Should not throw when trying to get stats for closed pool
      expect(() => poolManager.getStats(PoolType.READ_ONLY)).not.toThrow();
    });

    it('should close all pools', async () => {
      await poolManager.closeAllPools();
      
      // All pools should be closed
      const stats = poolManager.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pool types', () => {
      expect(() => poolManager.getPool('invalid' as PoolType)).toThrow();
      expect(() => poolManager.getDrizzle('invalid' as PoolType)).toThrow();
    });

    it('should handle connection timeouts', async () => {
      const mockPool = poolManager.getPool(PoolType.READ_ONLY);
      const mockConnect = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );
      mockPool.connect = mockConnect;

      await expect(
        poolManager.executeWithPool(PoolType.READ_ONLY, async () => 'test')
      ).rejects.toThrow('Connection timeout');
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate average response time', async () => {
      // Execute multiple operations to test average calculation
      await poolManager.executeWithPool(PoolType.READ_ONLY, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test1';
      });

      await poolManager.executeWithPool(PoolType.READ_ONLY, async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'test2';
      });

      const stats = poolManager.getStats(PoolType.READ_ONLY);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });
  });
});

describe('Pool Type Configuration', () => {
  it('should have correct pool type values', () => {
    expect(PoolType.READ_ONLY).toBe('read-only');
    expect(PoolType.WRITE_ONLY).toBe('write-only');
    expect(PoolType.READ_WRITE).toBe('read-write');
    expect(PoolType.ADMIN).toBe('admin');
    expect(PoolType.ANALYTICS).toBe('analytics');
  });
});
