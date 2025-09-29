/**
 * Vercel KV Client
 * 
 * This module provides a centralized Vercel KV client for the application
 * with connection management, error handling, and batch operations.
 */

import { kv } from '@vercel/kv';
import { VercelKVConfig, DEFAULT_VERCEL_KV_CONFIG, KV_KEYS } from './config';

export class VercelKVClient {
  private config: VercelKVConfig;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;

  constructor(config: Partial<VercelKVConfig> = {}) {
    this.config = { ...DEFAULT_VERCEL_KV_CONFIG, ...config };
    
    if (!this.config.url || !this.config.token) {
      console.warn('⚠️ Vercel KV configuration missing. KV features will be disabled.');
      this.isConnected = false;
      return;
    }

    this.isConnected = true;
  }

  /**
   * Initialize the Vercel KV connection
   */
  async initialize(): Promise<void> {
    if (!this.config.url || !this.config.token) {
      console.warn('⚠️ Vercel KV not configured. KV features will be disabled.');
      return;
    }

    try {
      // Test connection by setting and getting a test key
      const testKey = 'test:connection';
      await kv.set(testKey, 'test', { ex: 10 });
      const result = await kv.get(testKey);
      await kv.del(testKey);
      
      if (result === 'test') {
        this.isConnected = true;
        this.connectionAttempts = 0;
        console.log('✅ Vercel KV connected successfully');
      } else {
        throw new Error('KV connection test failed');
      }
    } catch (error) {
      console.error('❌ Vercel KV connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Check if Vercel KV is connected
   */
  isReady(): boolean {
    return this.isConnected && !!this.config.url && !!this.config.token;
  }

  /**
   * Set a key-value pair with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('⚠️ Vercel KV not ready, set operation skipped');
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      
      if (serializedValue.length > this.config.limits.maxValueSize) {
        console.warn(`⚠️ Value too large for key ${key}: ${serializedValue.length} bytes`);
        return false;
      }

      if (ttlSeconds) {
        await kv.set(key, serializedValue, { ex: ttlSeconds });
      } else {
        await kv.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('❌ Vercel KV set failed:', error);
      return false;
    }
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isReady()) {
      console.warn('⚠️ Vercel KV not ready, get operation skipped');
      return null;
    }

    try {
      const result = await kv.get(key);
      
      if (result === null) {
        return null;
      }

      return JSON.parse(result as string) as T;
    } catch (error) {
      console.error('❌ Vercel KV get failed:', error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    if (!this.isReady()) {
      console.warn('⚠️ Vercel KV not ready, delete operation skipped');
      return false;
    }

    try {
      const result = await kv.del(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Vercel KV delete failed:', error);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await kv.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Vercel KV exists check failed:', error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await kv.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error('❌ Vercel KV expire failed:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isReady()) {
      return -1;
    }

    try {
      const result = await kv.ttl(key);
      return result || -1;
    } catch (error) {
      console.error('❌ Vercel KV TTL check failed:', error);
      return -1;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isReady()) {
      return keys.map(() => null);
    }

    try {
      const results = await kv.mget(...keys);
      return (results || []).map((value: any) => {
        if (value === null) return null;
        try {
          return JSON.parse(value as string) as T;
        } catch (error) {
          console.error('❌ Failed to parse KV value:', error);
          return null;
        }
      });
    } catch (error) {
      console.error('❌ Vercel KV mget failed:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, any>, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const serializedPairs: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        
        if (serializedValue.length > this.config.limits.maxValueSize) {
          console.warn(`⚠️ Value too large for key ${key}: ${serializedValue.length} bytes`);
          continue;
        }
        
        serializedPairs[key] = serializedValue;
      }

      await kv.mset(serializedPairs);
      
      // Set TTL for all keys if specified
      if (ttlSeconds) {
        const keys = Object.keys(serializedPairs);
        await Promise.all(keys.map(key => kv.expire(key, ttlSeconds)));
      }

      return true;
    } catch (error) {
      console.error('❌ Vercel KV mset failed:', error);
      return false;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isReady()) {
      return [];
    }

    try {
      const results = await kv.keys(pattern);
      return results || [];
    } catch (error) {
      console.error('❌ Vercel KV keys failed:', error);
      return [];
    }
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys: string[]): Promise<number> {
    if (!this.isReady() || keys.length === 0) {
      return 0;
    }

    try {
      const results = await kv.del(...keys);
      return results || 0;
    } catch (error) {
      console.error('❌ Vercel KV delMultiple failed:', error);
      return 0;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      const result = await kv.incr(key);
      return result;
    } catch (error) {
      console.error('❌ Vercel KV incr failed:', error);
      return null;
    }
  }

  /**
   * Increment a counter with expiration
   */
  async incrEx(key: string, ttlSeconds: number): Promise<number | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      const result = await kv.incr(key);
      await kv.expire(key, ttlSeconds);
      return result;
    } catch (error) {
      console.error('❌ Vercel KV incrEx failed:', error);
      return null;
    }
  }

  /**
   * Get Vercel KV statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    connectionAttempts: number;
    config: VercelKVConfig;
  }> {
    return {
      connected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      config: this.config,
    };
  }

  /**
   * Close the Vercel KV connection
   */
  async close(): Promise<void> {
    this.isConnected = false;
    // Vercel KV doesn't need explicit closing
  }
}

// Singleton instance
let vercelKVClient: VercelKVClient | null = null;

export const getVercelKVClient = (config?: Partial<VercelKVConfig>): VercelKVClient => {
  if (!vercelKVClient) {
    vercelKVClient = new VercelKVClient(config);
  }
  return vercelKVClient;
};

export const initializeVercelKV = async (config?: Partial<VercelKVConfig>): Promise<VercelKVClient> => {
  const client = getVercelKVClient(config);
  await client.initialize();
  return client;
};
