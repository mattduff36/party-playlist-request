/**
 * Database Service Tests
 * 
 * Tests for the database service layer including query execution,
 * transaction management, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatabaseService } from '../database-service';
import { PoolType } from '../connection-pool';

// Mock connection pool manager
const mockPoolManager = {
  getDrizzle: jest.fn(),
  executeWithPool: jest.fn(),
  isHealthy: jest.fn().mockReturnValue(true),
  getStats: jest.fn().mockReturnValue(new Map()),
};

jest.mock('../connection-pool', () => ({
  getConnectionPoolManager: jest.fn(() => mockPoolManager),
  PoolType: {
    READ_ONLY: 'read-only',
    WRITE_ONLY: 'write-only',
    READ_WRITE: 'read-write',
    ADMIN: 'admin',
    ANALYTICS: 'analytics',
  },
  executeWithPool: jest.fn(),
}));

// Mock drizzle operations
const mockDrizzle = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{ id: 'test-id', name: 'test' }]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolManager.getDrizzle.mockReturnValue(mockDrizzle);
    mockPoolManager.executeWithPool.mockImplementation(async (poolType, operation) => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ test: 'data' }] }),
        release: jest.fn(),
      };
      return await operation(mockClient);
    });
    
    dbService = new DatabaseService({
      enableQueryLogging: false,
      enablePerformanceMetrics: true,
      maxRetries: 2,
      retryDelay: 10,
    });
  });

  describe('Event Operations', () => {
    it('should get event by ID', async () => {
      const mockEvent = { id: 'event-1', status: 'live', version: 1 };
      mockDrizzle.returning.mockResolvedValueOnce([mockEvent]);

      const result = await dbService.getEvent('event-1');

      expect(result).toEqual(mockEvent);
      expect(mockPoolManager.executeWithPool).toHaveBeenCalledWith(
        PoolType.READ_ONLY,
        expect.any(Function)
      );
    });

    it('should get latest event when no ID provided', async () => {
      const mockEvent = { id: 'event-1', status: 'live', version: 1 };
      mockDrizzle.returning.mockResolvedValueOnce([mockEvent]);

      const result = await dbService.getEvent();

      expect(result).toEqual(mockEvent);
      expect(mockDrizzle.orderBy).toHaveBeenCalled();
    });

    it('should create event', async () => {
      const eventData = { status: 'offline', version: 0 };
      const mockEvent = { id: 'event-1', ...eventData };
      mockDrizzle.returning.mockResolvedValueOnce([mockEvent]);

      const result = await dbService.createEvent(eventData);

      expect(result).toEqual(mockEvent);
      expect(mockPoolManager.executeWithPool).toHaveBeenCalledWith(
        PoolType.WRITE_ONLY,
        expect.any(Function)
      );
    });

    it('should update event', async () => {
      const updates = { status: 'live', version: 1 };
      const mockEvent = { id: 'event-1', ...updates };
      mockDrizzle.returning.mockResolvedValueOnce([mockEvent]);

      const result = await dbService.updateEvent('event-1', updates);

      expect(result).toEqual(mockEvent);
      expect(mockDrizzle.update).toHaveBeenCalled();
      expect(mockDrizzle.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updated_at: expect.any(Date),
        })
      );
    });

    it('should update event status', async () => {
      const mockEvent = { id: 'event-1', status: 'live', version: 2 };
      mockDrizzle.returning.mockResolvedValueOnce([mockEvent]);

      const result = await dbService.updateEventStatus('event-1', 'live', 2);

      expect(result).toEqual(mockEvent);
      expect(mockDrizzle.set).toHaveBeenCalledWith({
        status: 'live',
        version: 2,
        updated_at: expect.any(Date),
      });
    });
  });

  describe('Request Operations', () => {
    it('should get requests with pagination', async () => {
      const mockRequests = [
        { id: 'req-1', event_id: 'event-1', status: 'pending' },
        { id: 'req-2', event_id: 'event-1', status: 'approved' },
      ];
      mockDrizzle.returning
        .mockResolvedValueOnce(mockRequests)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await dbService.getRequests('event-1', 10, 0);

      expect(result.data).toEqual(mockRequests);
      expect(result.count).toBe(2);
      expect(result.poolType).toBe(PoolType.READ_ONLY);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should create request', async () => {
      const requestData = {
        event_id: 'event-1',
        track_id: 'track-1',
        track_data: { name: 'Test Song' },
        submitted_by: 'user-1',
      };
      const mockRequest = { id: 'req-1', ...requestData, status: 'pending' };
      mockDrizzle.returning.mockResolvedValueOnce([mockRequest]);

      const result = await dbService.createRequest(requestData);

      expect(result).toEqual(mockRequest);
      expect(mockDrizzle.insert).toHaveBeenCalled();
      expect(mockDrizzle.values).toHaveBeenCalledWith({
        status: 'pending',
        ...requestData,
      });
    });

    it('should update request status', async () => {
      const mockRequest = { id: 'req-1', status: 'approved', approved_at: expect.any(Date) };
      mockDrizzle.returning.mockResolvedValueOnce([mockRequest]);

      const result = await dbService.updateRequestStatus('req-1', 'approved', 'admin-1');

      expect(result).toEqual(mockRequest);
      expect(mockDrizzle.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          approved_at: expect.any(Date),
          updated_at: expect.any(Date),
        })
      );
    });
  });

  describe('Admin Operations', () => {
    it('should get admin by username', async () => {
      const mockAdmin = { id: 'admin-1', email: 'admin@test.com', name: 'Admin' };
      mockDrizzle.returning.mockResolvedValueOnce([mockAdmin]);

      const result = await dbService.getAdmin('admin@test.com');

      expect(result).toEqual(mockAdmin);
      expect(mockPoolManager.executeWithPool).toHaveBeenCalledWith(
        PoolType.READ_ONLY,
        expect.any(Function)
      );
    });

    it('should create admin', async () => {
      const adminData = {
        email: 'admin@test.com',
        password_hash: 'hashed-password',
        name: 'Admin',
      };
      const mockAdmin = { id: 'admin-1', ...adminData };
      mockDrizzle.returning.mockResolvedValueOnce([mockAdmin]);

      const result = await dbService.createAdmin(adminData);

      expect(result).toEqual(mockAdmin);
      expect(mockDrizzle.insert).toHaveBeenCalled();
    });
  });

  describe('Spotify Operations', () => {
    it('should get Spotify token', async () => {
      const mockToken = {
        admin_id: 'admin-1',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };
      mockDrizzle.returning.mockResolvedValueOnce([mockToken]);

      const result = await dbService.getSpotifyToken('admin-1');

      expect(result).toEqual(mockToken);
    });

    it('should upsert Spotify token', async () => {
      const tokenData = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };
      const mockToken = { admin_id: 'admin-1', ...tokenData };
      mockDrizzle.returning.mockResolvedValueOnce([mockToken]);

      const result = await dbService.upsertSpotifyToken('admin-1', tokenData);

      expect(result).toEqual(mockToken);
      expect(mockDrizzle.insert).toHaveBeenCalled();
    });
  });

  describe('Analytics Operations', () => {
    it('should get event stats', async () => {
      const mockStats = {
        totalRequests: 10,
        pendingRequests: 3,
        approvedRequests: 5,
        playedRequests: 2,
      };
      mockDrizzle.returning.mockResolvedValueOnce([mockStats]);

      const result = await dbService.getEventStats('event-1');

      expect(result).toEqual(mockStats);
      expect(mockPoolManager.executeWithPool).toHaveBeenCalledWith(
        PoolType.ANALYTICS,
        expect.any(Function)
      );
    });
  });

  describe('Transaction Management', () => {
    it('should execute transaction', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'test' }] }) // Query
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };

      mockPoolManager.executeWithPool.mockImplementation(async (poolType, operation) => {
        return await operation(mockClient);
      });

      const result = await dbService.executeTransaction(
        PoolType.READ_WRITE,
        async (client) => {
          const queryResult = await client.query('SELECT 1');
          return queryResult.rows[0];
        }
      );

      expect(result).toEqual({ id: 'test' });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('Query failed')) // Query fails
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };

      mockPoolManager.executeWithPool.mockImplementation(async (poolType, operation) => {
        return await operation(mockClient);
      });

      await expect(
        dbService.executeTransaction(
          PoolType.READ_WRITE,
          async (client) => {
            await client.query('SELECT 1');
            throw new Error('Transaction failed');
          }
        )
      ).rejects.toThrow('Transaction failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed operations', async () => {
      let attemptCount = 0;
      mockPoolManager.executeWithPool.mockImplementation(async (poolType, operation) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return await operation({ query: vi.fn(), release: vi.fn() });
      });

      const result = await dbService.getEvent('event-1');

      expect(attemptCount).toBe(2);
      expect(result).toBeDefined();
    });

    it('should fail after max retries', async () => {
      mockPoolManager.executeWithPool.mockRejectedValue(new Error('Persistent failure'));

      await expect(dbService.getEvent('event-1')).rejects.toThrow('Persistent failure');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track query statistics', async () => {
      await dbService.getEvent('event-1');
      await dbService.getEvent('event-2');

      const stats = dbService.getStats();

      expect(stats.totalQueries).toBe(2);
      expect(stats.averageQueryTime).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBe(0);
    });

    it('should perform health check', async () => {
      const healthCheck = await dbService.healthCheck();

      expect(healthCheck).toHaveProperty('healthy');
      expect(healthCheck).toHaveProperty('details');
      expect(typeof healthCheck.healthy).toBe('boolean');
    });
  });
});
