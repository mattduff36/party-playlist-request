/**
 * Tests for DatabaseCache
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatabaseCache } from '../database-cache';

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn()
  }
}));

describe('DatabaseCache', () => {
  let cache: DatabaseCache;
  let mockDb: any;

  beforeEach(() => {
    cache = new DatabaseCache();
    mockDb = require('@/lib/db').db;
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      const result = await cache.get('non-existent');
      
      expect(result).toBeNull();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value, expires_at'),
        ['non-existent']
      );
    });

    it('should return value for existing key', async () => {
      const testValue = { test: 'data' };
      mockDb.execute.mockResolvedValue({
        rows: [{ value: JSON.stringify(testValue), expires_at: new Date(Date.now() + 3600000) }]
      });
      
      const result = await cache.get('test-key');
      
      expect(result).toEqual(testValue);
    });

    it('should return null for expired key', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [{ value: '{"test":"data"}', expires_at: new Date(Date.now() - 1000) }]
      });
      
      const result = await cache.get('expired-key');
      
      expect(result).toBeNull();
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // Once for get, once for delete
    });
  });

  describe('set', () => {
    it('should set a value with TTL', async () => {
      const testValue = { test: 'data' };
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      await cache.set('test-key', testValue, 3600);
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cache_entries'),
        ['test-key', JSON.stringify(testValue), expect.any(Date)]
      );
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      await cache.delete('test-key');
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cache_entries'),
        ['test-key']
      );
    });
  });

  describe('clearExpired', () => {
    it('should clear expired entries', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      await cache.clearExpired();
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cache_entries WHERE expires_at <= NOW()')
      );
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [{ expired: '2' }] })
        .mockResolvedValueOnce({ rows: [{ size: '1024' }] });
      
      const stats = await cache.getStats();
      
      expect(stats).toEqual({
        totalEntries: 5,
        expiredEntries: 2,
        memoryUsage: 1024
      });
    });
  });
});
