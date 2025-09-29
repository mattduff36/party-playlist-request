/**
 * Vercel KV Cache
 * 
 * This module provides caching functionality using Vercel KV
 * for frequently accessed data with intelligent TTL management.
 */

import { getVercelKVClient } from './client';
import { KV_KEYS, KV_PATTERNS } from './config';

export interface VercelKVCacheConfig {
  defaultTtl: number; // Default TTL in seconds
  maxKeys: number; // Maximum cache size
  compression?: boolean; // Enable compression for large values
}

export interface VercelKVCacheOptions {
  ttl?: number; // TTL in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Force compression
}

export class VercelKVCache {
  private kv = getVercelKVClient();
  private config: VercelKVCacheConfig;

  constructor(config: Partial<VercelKVCacheConfig> = {}) {
    this.config = {
      defaultTtl: 1800, // 30 minutes
      maxKeys: 1000,
      compression: true,
      ...config,
    };
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.kv.isReady()) {
      console.warn('⚠️ Vercel KV not available, cache miss');
      return null;
    }

    try {
      const cacheKey = KV_KEYS.EVENT(key); // Use event namespace for general cache
      const value = await this.kv.get<T>(cacheKey);
      
      if (value === null) {
        return null;
      }

      // Update access time for LRU
      await this.updateAccessTime(cacheKey);
      
      return value;
    } catch (error) {
      console.error('❌ Vercel KV cache get failed:', error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(
    key: string, 
    value: any, 
    options: VercelKVCacheOptions = {}
  ): Promise<boolean> {
    if (!this.kv.isReady()) {
      console.warn('⚠️ Vercel KV not available, cache set skipped');
      return false;
    }

    try {
      const cacheKey = KV_KEYS.EVENT(key);
      const ttl = options.ttl || this.config.defaultTtl;
      
      // Store value with metadata
      const cacheData = {
        value,
        timestamp: Date.now(),
        tags: options.tags || [],
        compressed: options.compress || false,
      };

      const success = await this.kv.set(cacheKey, cacheData, ttl);
      
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
      console.error('❌ Vercel KV cache set failed:', error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.kv.isReady()) {
      return false;
    }

    try {
      const cacheKey = KV_KEYS.EVENT(key);
      return await this.kv.del(cacheKey);
    } catch (error) {
      console.error('❌ Vercel KV cache delete failed:', error);
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (!this.kv.isReady()) {
      return false;
    }

    try {
      const cacheKey = KV_KEYS.EVENT(key);
      return await this.kv.exists(cacheKey);
    } catch (error) {
      console.error('❌ Vercel KV cache has check failed:', error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.kv.isReady()) {
      return keys.map(() => null);
    }

    try {
      const cacheKeys = keys.map(key => KV_KEYS.EVENT(key));
      const values = await this.kv.mget<{ value: T; timestamp: number; tags: string[]; compressed: boolean }>(cacheKeys);
      
      // Update access times and extract values
      const results = values.map(async (data, index) => {
        if (data === null) return null;
        
        await this.updateAccessTime(cacheKeys[index]);
        return data.value;
      });

      return await Promise.all(results);
    } catch (error) {
      console.error('❌ Vercel KV cache mget failed:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(
    keyValuePairs: Record<string, any>,
    options: VercelKVCacheOptions = {}
  ): Promise<boolean> {
    if (!this.kv.isReady()) {
      return false;
    }

    try {
      const ttl = options.ttl || this.config.defaultTtl;
      const cacheData: Record<string, any> = {};

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const cacheKey = KV_KEYS.EVENT(key);
        cacheData[cacheKey] = {
          value,
          timestamp: Date.now(),
          tags: options.tags || [],
          compressed: options.compress || false,
        };
      }

      const success = await this.kv.mset(cacheData, ttl);
      
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
      console.error('❌ Vercel KV cache mset failed:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.kv.isReady()) {
      return 0;
    }

    try {
      let totalDeleted = 0;
      
      for (const tag of tags) {
        const tagKey = `cache_tag:${tag}`;
        const keys = await this.kv.keys(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.kv.delMultiple(keys);
          totalDeleted += deleted;
        }
      }

      return totalDeleted;
    } catch (error) {
      console.error('❌ Vercel KV cache invalidation failed:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<number> {
    if (!this.kv.isReady()) {
      return 0;
    }

    try {
      const keys = await this.kv.keys(KV_PATTERNS.EVENTS);
      return await this.kv.delMultiple(keys);
    } catch (error) {
      console.error('❌ Vercel KV cache clear failed:', error);
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
    config: VercelKVCacheConfig;
  }> {
    if (!this.kv.isReady()) {
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        config: this.config,
      };
    }

    try {
      const keys = await this.kv.keys(KV_PATTERNS.EVENTS);
      
      // Calculate approximate memory usage
      let memoryUsage = 0;
      for (const key of keys) {
        const ttl = await this.kv.ttl(key);
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
      console.error('❌ Vercel KV cache statistics failed:', error);
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
      await this.kv.set(accessKey, Date.now(), 3600); // 1 hour TTL
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
        await this.kv.set(tagKey, cacheKey, 3600); // 1 hour TTL
      }
    } catch (error) {
      // Ignore tag storage errors
    }
  }
}

// Singleton cache instance
let cache: VercelKVCache | null = null;

export const getVercelKVCache = (config?: Partial<VercelKVCacheConfig>): VercelKVCache => {
  if (!cache) {
    cache = new VercelKVCache(config);
  }
  return cache;
};

// Predefined cache instances for different use cases
export const createVercelKVCaches = () => {
  return {
    // General purpose cache
    general: new VercelKVCache({
      defaultTtl: 1800, // 30 minutes
      maxKeys: 1000,
    }),

    // Event data cache
    events: new VercelKVCache({
      defaultTtl: 300, // 5 minutes
      maxKeys: 100,
    }),

    // User data cache
    users: new VercelKVCache({
      defaultTtl: 900, // 15 minutes
      maxKeys: 500,
    }),

    // Spotify data cache
    spotify: new VercelKVCache({
      defaultTtl: 600, // 10 minutes
      maxKeys: 200,
    }),

    // Session cache
    sessions: new VercelKVCache({
      defaultTtl: 3600, // 1 hour
      maxKeys: 1000,
    }),

    // Song requests cache
    requests: new VercelKVCache({
      defaultTtl: 1800, // 30 minutes
      maxKeys: 500,
    }),
  };
};

export const vercelKVCaches = createVercelKVCaches();
