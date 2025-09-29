/**
 * Redis-based Cache
 * 
 * This module provides caching functionality using Redis
 * for frequently accessed data and computed results.
 */

import { getRedisClient } from './client';
import { REDIS_KEYS } from './config';

export interface CacheConfig {
  defaultTtl: number; // Default TTL in seconds
  maxSize: number; // Maximum cache size
  compression?: boolean; // Enable compression for large values
}

export interface CacheOptions {
  ttl?: number; // TTL in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Force compression
}

export class RedisCache {
  private redis = getRedisClient();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 1800, // 30 minutes
      maxSize: 1000,
      compression: true,
      ...config,
    };
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.redis.isReady()) {
      console.warn('⚠️ Redis not available, cache miss');
      return null;
    }

    try {
      const cacheKey = REDIS_KEYS.CACHE(key);
      const value = await this.redis.get<T>(cacheKey);
      
      if (value === null) {
        return null;
      }

      // Update access time for LRU
      await this.updateAccessTime(cacheKey);
      
      return value;
    } catch (error) {
      console.error('❌ Cache get failed:', error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(
    key: string, 
    value: any, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.redis.isReady()) {
      console.warn('⚠️ Redis not available, cache set skipped');
      return false;
    }

    try {
      const cacheKey = REDIS_KEYS.CACHE(key);
      const ttl = options.ttl || this.config.defaultTtl;
      
      // Store value with metadata
      const cacheData = {
        value,
        timestamp: Date.now(),
        tags: options.tags || [],
        compressed: options.compress || false,
      };

      const success = await this.redis.set(cacheKey, cacheData, ttl);
      
      if (success) {
        // Update access time
        await this.updateAccessTime(cacheKey);
        
        // Store tags for invalidation
        if (options.tags && options.tags.length > 0) {
          await this.storeTags(cacheKey, options.tags);
        }
      }

      return success;
    } catch (error) {
      console.error('❌ Cache set failed:', error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.redis.isReady()) {
      return false;
    }

    try {
      const cacheKey = REDIS_KEYS.CACHE(key);
      return await this.redis.del(cacheKey);
    } catch (error) {
      console.error('❌ Cache delete failed:', error);
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (!this.redis.isReady()) {
      return false;
    }

    try {
      const cacheKey = REDIS_KEYS.CACHE(key);
      return await this.redis.exists(cacheKey);
    } catch (error) {
      console.error('❌ Cache has check failed:', error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis.isReady()) {
      return keys.map(() => null);
    }

    try {
      const cacheKeys = keys.map(key => REDIS_KEYS.CACHE(key));
      const values = await this.redis.mget<{ value: T; timestamp: number; tags: string[]; compressed: boolean }>(cacheKeys);
      
      // Update access times and extract values
      const results = values.map(async (data, index) => {
        if (data === null) return null;
        
        await this.updateAccessTime(cacheKeys[index]);
        return data.value;
      });

      return await Promise.all(results);
    } catch (error) {
      console.error('❌ Cache mget failed:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(
    keyValuePairs: Record<string, any>,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.redis.isReady()) {
      return false;
    }

    try {
      const ttl = options.ttl || this.config.defaultTtl;
      const cacheData: Record<string, any> = {};

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const cacheKey = REDIS_KEYS.CACHE(key);
        cacheData[cacheKey] = {
          value,
          timestamp: Date.now(),
          tags: options.tags || [],
          compressed: options.compress || false,
        };
      }

      const success = await this.redis.mset(cacheData);
      
      if (success && options.tags && options.tags.length > 0) {
        // Store tags for all keys
        await Promise.all(
          Object.keys(cacheData).map(cacheKey => 
            this.storeTags(cacheKey, options.tags!)
          )
        );
      }

      return success;
    } catch (error) {
      console.error('❌ Cache mset failed:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.redis.isReady()) {
      return 0;
    }

    try {
      let totalDeleted = 0;
      
      for (const tag of tags) {
        const tagKey = `cache_tag:${tag}`;
        const keys = await this.redis.keys(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.redis.delMultiple(keys);
          totalDeleted += deleted;
        }
      }

      return totalDeleted;
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<number> {
    if (!this.redis.isReady()) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(REDIS_KEYS.CACHE('*'));
      return await this.redis.delMultiple(keys);
    } catch (error) {
      console.error('❌ Cache clear failed:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
    config: CacheConfig;
  }> {
    if (!this.redis.isReady()) {
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        config: this.config,
      };
    }

    try {
      const keys = await this.redis.keys(REDIS_KEYS.CACHE('*'));
      
      // Calculate approximate memory usage
      let memoryUsage = 0;
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl > 0) {
          memoryUsage += 1; // Approximate
        }
      }

      return {
        totalKeys: keys.length,
        memoryUsage,
        hitRate: 0, // Would need to track hits/misses
        config: this.config,
      };
    } catch (error) {
      console.error('❌ Cache statistics failed:', error);
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        config: this.config,
      };
    }
  }

  /**
   * Update access time for LRU
   */
  private async updateAccessTime(cacheKey: string): Promise<void> {
    try {
      const accessKey = `cache_access:${cacheKey}`;
      await this.redis.set(accessKey, Date.now(), 3600); // 1 hour TTL
    } catch (error) {
      // Ignore access time update errors
    }
  }

  /**
   * Store cache tags for invalidation
   */
  private async storeTags(cacheKey: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `cache_tag:${tag}`;
        await this.redis.set(tagKey, cacheKey, 3600); // 1 hour TTL
      }
    } catch (error) {
      // Ignore tag storage errors
    }
  }
}

// Singleton cache instance
let cache: RedisCache | null = null;

export const getCache = (config?: Partial<CacheConfig>): RedisCache => {
  if (!cache) {
    cache = new RedisCache(config);
  }
  return cache;
};

// Predefined cache instances for different use cases
export const createCaches = () => {
  return {
    // General purpose cache
    general: new RedisCache({
      defaultTtl: 1800, // 30 minutes
      maxSize: 1000,
    }),

    // Event data cache
    events: new RedisCache({
      defaultTtl: 300, // 5 minutes
      maxSize: 100,
    }),

    // User data cache
    users: new RedisCache({
      defaultTtl: 900, // 15 minutes
      maxSize: 500,
    }),

    // Spotify data cache
    spotify: new RedisCache({
      defaultTtl: 600, // 10 minutes
      maxSize: 200,
    }),

    // Session cache
    sessions: new RedisCache({
      defaultTtl: 3600, // 1 hour
      maxSize: 1000,
    }),
  };
};

export const caches = createCaches();
