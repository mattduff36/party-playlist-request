/**
 * Vercel KV Client Tests
 */

import { VercelKVClient } from '../client';
import { DEFAULT_VERCEL_KV_CONFIG } from '../config';

// Mock @vercel/kv
jest.mock('@vercel/kv', () => ({
  kv: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('{"test": "value"}'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    mget: jest.fn().mockResolvedValue(['{"test": "value1"}', '{"test": "value2"}']),
    mset: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue(['key1', 'key2']),
    incr: jest.fn().mockResolvedValue(1),
  },
}));

describe('VercelKVClient', () => {
  let client: VercelKVClient;

  beforeEach(() => {
    // Set up environment variables for Vercel KV
    process.env.KV_URL = 'https://test-kv.vercel-storage.com';
    process.env.KV_REST_API_URL = 'https://test-kv.vercel-storage.com';
    
    client = new VercelKVClient({
      url: 'https://test-kv.vercel-storage.com',
      token: 'test-token',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(client).toBeInstanceOf(VercelKVClient);
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        url: 'custom-url',
        token: 'custom-token',
        ttl: {
          events: 600,
          users: 1800,
          spotify: 1200,
          sessions: 7200,
          requests: 3600,
        },
      };
      
      const customClient = new VercelKVClient(customConfig);
      expect(customClient).toBeInstanceOf(VercelKVClient);
    });

    it('should handle missing Vercel KV credentials', () => {
      const clientWithoutCreds = new VercelKVClient({
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
      const { kv } = require('@vercel/kv');
      kv.set.mockRejectedValueOnce(new Error('Connection failed'));

      const failingClient = new VercelKVClient({
        url: 'https://test-kv.vercel-storage.com',
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
      const { kv } = require('@vercel/kv');
      kv.get.mockResolvedValueOnce(null);
      
      const result = await client.get('non-existent-key');
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

    it('should set multiple key-value pairs with TTL', async () => {
      const keyValuePairs = {
        'key1': { test: 'value1' },
        'key2': { test: 'value2' },
      };
      
      const result = await client.mset(keyValuePairs, 3600);
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
    it('should handle Vercel KV operation failures gracefully', async () => {
      const { kv } = require('@vercel/kv');
      kv.set.mockRejectedValueOnce(new Error('KV error'));
      
      const result = await client.set('test-key', 'test-value');
      expect(result).toBe(false);
    });

    it('should handle JSON parsing errors', async () => {
      const { kv } = require('@vercel/kv');
      kv.get.mockResolvedValueOnce('invalid-json');
      
      const result = await client.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle value size limits', async () => {
      const largeValue = 'x'.repeat(2 * 1024 * 1024); // 2MB
      
      const result = await client.set('test-key', largeValue);
      expect(result).toBe(false);
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
