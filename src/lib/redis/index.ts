/**
 * Redis Module Index
 * 
 * This module exports all Redis-related functionality
 * for rate limiting and caching.
 */

export * from './config';
export * from './client';
import { initializeRedis } from './client';
export * from './rate-limiter';
export * from './cache';

// Re-export commonly used items
export { 
  getRedisClient, 
  initializeRedis,
  RedisClient 
} from './client';

export { 
  RedisRateLimiter, 
  rateLimiters, 
  createRateLimiters 
} from './rate-limiter';

export { 
  RedisCache, 
  caches, 
  getCache, 
  createCaches 
} from './cache';

// Initialize Redis on module load
export const initializeRedisModule = async () => {
  try {
    const client = await initializeRedis();
    console.log('✅ Redis module initialized successfully');
    return client;
  } catch (error) {
    console.warn('⚠️ Redis module initialization failed:', error);
    return null;
  }
};
