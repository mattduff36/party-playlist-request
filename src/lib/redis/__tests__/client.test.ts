/**
 * Redis Client Tests
 */

import { RedisClient } from '../client';
import { DEFAULT_REDIS_CONFIG } from '../config';

// Mock @upstash/redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('{"test": "value"}'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    incr: jest.fn().mockResolvedValue(1),
    mget: jest.fn().mockResolvedValue(['{"test": "value1"}', '{"test": "value2"}']),
    mset: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue(['key1', 'key2']),
    pipeline: jest.fn().mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([1, 1]),
    }),
  })),
}));

describe('RedisClient', () => {
  let client: RedisClient;

  beforeEach(() => {
    // Set up environment variables for Redis
    process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    
    client = new RedisClient({
      url: 'https://test-redis.upstash.io',
      token: 'test-token',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(client).toBeInstanceOf(RedisClient);
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        url: 'custom-url',
        token: 'custom-token',
        ttl: {
          rateLimit: 7200,
          cache: 3600,
          session: 172800,
        },
      };
      
      const customClient = new RedisClient(customConfig);
      expect(customClient).toBeInstanceOf(RedisClient);
    });

    it('should handle missing Redis credentials', () => {
      const clientWithoutCreds = new RedisClient({
        url: '',
        token: '',
      });
      
      expect(clientWithoutCreds.isReady()).toBe(false);
    });
  });

  describe('connection', () => {
    it('should initialize connection successfully', async () => {
      await expect(client.initialize()).resolves.toBeUndefined();
      expect(client.isReady()).toBe(true);
    });

    it('should handle connection failure', async () => {
      const { Redis } = require('@upstash/redis');
      Redis.mockImplementationOnce(() => ({
        ping: jest.fn().mockRejectedValue(new Error('Connection failed')),
      }));

      const failingClient = new RedisClient({
        url: 'https://test-redis.upstash.io',
        token: 'test-token',
      });
      await expect(failingClient.initialize()).rejects.toThrow('Connection failed');
      expect(failingClient.isReady()).toBe(false);
    });
  });

  describe('basic operations', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should set a key-value pair', async () => {
      const result = await client.set('test-key', { test: 'value' });
      expect(result).toBe(true);
    });

    it('should set a key-value pair with TTL', async () => {
      const result = await client.set('test-key', { test: 'value' }, 3600);
      expect(result).toBe(true);
    });

    it('should get a value by key', async () => {
      const result = await client.get('test-key');
      expect(result).toEqual({ test: 'value' });
    });

    it('should return null for non-existent key', async () => {
      const { Redis } = require('@upstash/redis');
      Redis.mockImplementationOnce(() => ({
        ping: jest.fn().mockResolvedValue('PONG'),
        get: jest.fn().mockResolvedValue(null),
      }));

      const clientWithNullGet = new RedisClient({
        url: 'https://test-redis.upstash.io',
        token: 'test-token',
      });
      await clientWithNullGet.initialize();
      
      const result = await clientWithNullGet.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      const result = await client.del('test-key');
      expect(result).toBe(true);
    });

    it('should check if key exists', async () => {
      const result = await client.exists('test-key');
      expect(result).toBe(true);
    });

    it('should set expiration for key', async () => {
      const result = await client.expire('test-key', 3600);
      expect(result).toBe(true);
    });

    it('should get TTL for key', async () => {
      const result = await client.ttl('test-key');
      expect(result).toBe(3600);
    });
  });

  describe('counter operations', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should increment a counter', async () => {
      const result = await client.incr('counter-key');
      expect(result).toBe(1);
    });

    it('should increment counter with expiration', async () => {
      const result = await client.incrEx('counter-key', 3600);
      expect(result).toBe(1);
    });
  });

  describe('batch operations', () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it('should get multiple keys', async () => {
      const result = await client.mget(['key1', 'key2']);
      expect(result).toEqual([{ test: 'value1' }, { test: 'value2' }]);
    });

    it('should set multiple key-value pairs', async () => {
      const keyValuePairs = {
        'key1': { test: 'value1' },
        'key2': { test: 'value2' },
      };
      
      const result = await client.mset(keyValuePairs);
      expect(result).toBe(true);
    });

    it('should get all keys matching pattern', async () => {
      const result = await client.keys('test-*');
      expect(result).toEqual(['key1', 'key2']);
    });

    it('should delete multiple keys', async () => {
      const result = await client.delMultiple(['key1', 'key2']);
      expect(result).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle Redis operation failures gracefully', async () => {
      const { Redis } = require('@upstash/redis');
      Redis.mockImplementationOnce(() => ({
        ping: jest.fn().mockResolvedValue('PONG'),
        set: jest.fn().mockRejectedValue(new Error('Redis error')),
      }));

      const failingClient = new RedisClient({
        url: 'https://test-redis.upstash.io',
        token: 'test-token',
      });
      await failingClient.initialize();
      
      const result = await failingClient.set('test-key', 'test-value');
      expect(result).toBe(false);
    });

    it('should handle JSON parsing errors', async () => {
      const { Redis } = require('@upstash/redis');
      Redis.mockImplementationOnce(() => ({
        ping: jest.fn().mockResolvedValue('PONG'),
        get: jest.fn().mockResolvedValue('invalid-json'),
      }));

      const clientWithInvalidJson = new RedisClient({
        url: 'https://test-redis.upstash.io',
        token: 'test-token',
      });
      await clientWithInvalidJson.initialize();
      
      const result = await clientWithInvalidJson.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should return client statistics', async () => {
      await client.initialize();
      
      const stats = await client.getStats();
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('connectionAttempts');
      expect(stats).toHaveProperty('config');
      expect(stats.connected).toBe(true);
    });
  });
});
