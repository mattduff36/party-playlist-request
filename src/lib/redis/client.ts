/**
 * Redis Client
 * 
 * This module provides a centralized Redis client for the application
 * with connection pooling, error handling, and retry logic.
 */

import { Redis } from '@upstash/redis';
import { RedisConfig, DEFAULT_REDIS_CONFIG, REDIS_KEYS } from './config';

export class RedisClient {
  private client!: Redis;
  private config: RedisConfig;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...DEFAULT_REDIS_CONFIG, ...config };
    
    if (!this.config.url || !this.config.token) {
      console.warn('⚠️ Redis configuration missing. Redis features will be disabled.');
      this.isConnected = false;
      return;
    }

    this.client = new Redis({
      url: this.config.url,
      token: this.config.token,
    });
  }

  /**
   * Initialize the Redis connection
   */
  async initialize(): Promise<void> {
    if (!this.client) {
      console.warn('⚠️ Redis client not initialized. Redis features will be disabled.');
      return;
    }

    try {
      // Test connection
      await this.client.ping();
      this.isConnected = true;
      this.connectionAttempts = 0;
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && !!this.client;
  }

  /**
   * Execute a Redis command with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    if (!this.isReady()) {
      console.warn(`⚠️ Redis not ready for operation: ${operationName}`);
      return null;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.limits.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Redis operation failed (attempt ${attempt}/${this.config.limits.retryAttempts}): ${operationName}`, error);

        if (attempt < this.config.limits.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.limits.retryDelay * attempt));
        }
      }
    }

    console.error(`❌ Redis operation failed after ${this.config.limits.retryAttempts} attempts: ${operationName}`, lastError);
    return null;
  }

  /**
   * Set a key-value pair with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      if (ttlSeconds) {
        return await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      } else {
        return await this.client.set(key, JSON.stringify(value));
      }
    }, `SET ${key}`);

    return result === 'OK';
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.get(key);
    }, `GET ${key}`);

    if (result === null) return null;

    try {
      return JSON.parse(result as string) as T;
    } catch (error) {
      console.error('❌ Failed to parse Redis value:', error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.del(key);
    }, `DEL ${key}`);

    return result === 1;
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.exists(key);
    }, `EXISTS ${key}`);

    return result === 1;
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.expire(key, ttlSeconds);
    }, `EXPIRE ${key}`);

    return result === 1;
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.ttl(key);
    }, `TTL ${key}`);

    return result || -1;
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number | null> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.incr(key);
    }, `INCR ${key}`);

    return result;
  }

  /**
   * Increment a counter with expiration
   */
  async incrEx(key: string, ttlSeconds: number): Promise<number | null> {
    const result = await this.executeWithRetry(async () => {
      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);
      const results = await pipeline.exec();
      return results?.[0] as number;
    }, `INCR ${key} with EXPIRE`);

    return result;
  }

  /**
   * Get multiple keys
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.mget(...keys);
    }, `MGET ${keys.join(', ')}`);

    return (result || []).map((value: any) => {
      if (value === null) return null;
      try {
        return JSON.parse(value as string) as T;
      } catch (error) {
        console.error('❌ Failed to parse Redis value:', error);
        return null;
      }
    });
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, any>): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      const serializedPairs: Record<string, string> = {};
      for (const [key, value] of Object.entries(keyValuePairs)) {
        serializedPairs[key] = JSON.stringify(value);
      }
      return await this.client.mset(serializedPairs);
    }, `MSET ${Object.keys(keyValuePairs).join(', ')}`);

    return result === 'OK';
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const result = await this.executeWithRetry(async () => {
      return await this.client.keys(pattern);
    }, `KEYS ${pattern}`);

    return result || [];
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const result = await this.executeWithRetry(async () => {
      return await this.client.del(...keys);
    }, `DEL ${keys.join(', ')}`);

    return result || 0;
  }

  /**
   * Get Redis statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    connectionAttempts: number;
    config: RedisConfig;
  }> {
    return {
      connected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      config: this.config,
    };
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    this.isConnected = false;
    // Upstash Redis client doesn't need explicit closing
  }
}

// Singleton instance
let redisClient: RedisClient | null = null;

export const getRedisClient = (config?: Partial<RedisConfig>): RedisClient => {
  if (!redisClient) {
    redisClient = new RedisClient(config);
  }
  return redisClient;
};

export const initializeRedis = async (config?: Partial<RedisConfig>): Promise<RedisClient> => {
  const client = getRedisClient(config);
  await client.initialize();
  return client;
};
