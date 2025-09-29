/**
 * Redis Cache Tests
 */

import { RedisCache, createCaches } from '../cache';
import { getRedisClient } from '../client';

// Mock Redis client
jest.mock('../client', () => ({
  getRedisClient: jest.fn(() => ({
    isReady: jest.fn().mockReturnValue(true),
    get: jest.fn().mockResolvedValue({ value: 'test-value', timestamp: Date.now(), tags: [], compressed: false }),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(true),
    ttl: jest.fn().mockResolvedValue(3600),
    mget: jest.fn().mockResolvedValue([
      { value: 'value1', timestamp: Date.now(), tags: [], compressed: false },
      { value: 'value2', timestamp: Date.now(), tags: [], compressed: false },
    ]),
    mset: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue(['cache:key1', 'cache:key2']),
    delMultiple: jest.fn().mockResolvedValue(2),
  })),
}));

describe('RedisCache', () => {
  let cache: RedisCache;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = getRedisClient();
    cache = new RedisCache({
      defaultTtl: 1800,
      maxSize: 1000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic operations', () => {
    it('should get a value from cache', async () => {
      const result = await cache.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedis.get).toHaveBeenCalledWith('cache:test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should set a value in cache', async () => {
      const result = await cache.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'cache:test-key',
        expect.objectContaining({
          value: 'test-value',
          timestamp: expect.any(Number),
          tags: [],
          compressed: false,
        }),
        1800
      );
    });

    it('should set a value with custom options', async () => {
      const result = await cache.set('test-key', 'test-value', {
        ttl: 3600,
        tags: ['tag1', 'tag2'],
        compress: true,
      });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'cache:test-key',
        expect.objectContaining({
          value: 'test-value',
          timestamp: expect.any(Number),
          tags: ['tag1', 'tag2'],
          compressed: true,
        }),
        3600
      );
    });

    it('should delete a value from cache', async () => {
      const result = await cache.del('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('cache:test-key');
    });

    it('should check if key exists', async () => {
      const result = await cache.has('test-key');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('cache:test-key');
    });
  });

  describe('batch operations', () => {
    it('should get multiple values', async () => {
      const result = await cache.mget(['key1', 'key2']);

      expect(result).toEqual(['value1', 'value2']);
      expect(mockRedis.mget).toHaveBeenCalledWith('cache:key1', 'cache:key2');
    });

    it('should set multiple values', async () => {
      const keyValuePairs = {
        'key1': 'value1',
        'key2': 'value2',
      };

      const result = await cache.mset(keyValuePairs);

      expect(result).toBe(true);
      expect(mockRedis.mset).toHaveBeenCalledWith(
        expect.objectContaining({
          'cache:key1': expect.objectContaining({ value: 'value1' }),
          'cache:key2': expect.objectContaining({ value: 'value2' }),
        })
      );
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache by tags', async () => {
      mockRedis.keys.mockResolvedValue(['cache_tag:tag1']);

      const result = await cache.invalidateByTags(['tag1']);

      expect(result).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('cache_tag:tag1');
      expect(mockRedis.delMultiple).toHaveBeenCalledWith(['cache_tag:tag1']);
    });

    it('should clear all cache entries', async () => {
      const result = await cache.clear();

      expect(result).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('cache:*');
      expect(mockRedis.delMultiple).toHaveBeenCalledWith(['cache:key1', 'cache:key2']);
    });
  });

  describe('error handling', () => {
    it('should handle Redis unavailability', async () => {
      mockRedis.isReady.mockReturnValue(false);

      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle Redis operation failures', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should return cache statistics', async () => {
      const stats = await cache.getStatistics();

      expect(stats).toEqual({
        totalKeys: 2,
        memoryUsage: 2,
        hitRate: 0,
        config: {
          defaultTtl: 1800,
          maxSize: 1000,
          compression: true,
        },
      });
    });

    it('should handle statistics errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await cache.getStatistics();

      expect(stats).toEqual({
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        config: {
          defaultTtl: 1800,
          maxSize: 1000,
          compression: true,
        },
      });
    });
  });
});

describe('createCaches', () => {
  it('should create predefined cache instances', () => {
    const caches = createCaches();

    expect(caches).toHaveProperty('general');
    expect(caches).toHaveProperty('events');
    expect(caches).toHaveProperty('users');
    expect(caches).toHaveProperty('spotify');
    expect(caches).toHaveProperty('sessions');

    expect(caches.general).toBeInstanceOf(RedisCache);
    expect(caches.events).toBeInstanceOf(RedisCache);
    expect(caches.users).toBeInstanceOf(RedisCache);
    expect(caches.spotify).toBeInstanceOf(RedisCache);
    expect(caches.sessions).toBeInstanceOf(RedisCache);
  });

  it('should have correct configurations for each cache', () => {
    const caches = createCaches();

    // General cache
    expect(caches.general['config']).toEqual({
      defaultTtl: 1800, // 30 minutes
      maxSize: 1000,
      compression: true,
    });

    // Events cache
    expect(caches.events['config']).toEqual({
      defaultTtl: 300, // 5 minutes
      maxSize: 100,
      compression: true,
    });

    // Users cache
    expect(caches.users['config']).toEqual({
      defaultTtl: 900, // 15 minutes
      maxSize: 500,
      compression: true,
    });

    // Spotify cache
    expect(caches.spotify['config']).toEqual({
      defaultTtl: 600, // 10 minutes
      maxSize: 200,
      compression: true,
    });

    // Sessions cache
    expect(caches.sessions['config']).toEqual({
      defaultTtl: 3600, // 1 hour
      maxSize: 1000,
      compression: true,
    });
  });
});
