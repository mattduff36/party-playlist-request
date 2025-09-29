/**
 * Redis-based Rate Limiter
 * 
 * This module provides rate limiting functionality using Redis
 * for distributed rate limiting across multiple instances.
 */

import { getRedisClient } from './client';
import { REDIS_KEYS } from './config';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
  keyGenerator?: (req: any) => string; // Custom key generator
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RedisRateLimiter {
  private redis = getRedisClient();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };
  }

  /**
   * Check if a request is allowed based on rate limits
   */
  async checkRateLimit(
    identifier: string,
    action: string = 'default'
  ): Promise<RateLimitResult> {
    if (!this.redis.isReady()) {
      // If Redis is not available, allow the request
      console.warn('⚠️ Redis not available, allowing request');
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    const key = REDIS_KEYS.RATE_LIMIT(identifier, 'system', action);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Get current count
      const currentCount = await this.redis.get<number>(key) || 0;
      
      if (currentCount >= this.config.maxRequests) {
        // Rate limit exceeded
        const ttl = await this.redis.ttl(key);
        const resetTime = now + (ttl > 0 ? ttl * 1000 : this.config.windowMs);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000),
        };
      }

      // Increment counter
      const newCount = await this.redis.incrEx(key, Math.ceil(this.config.windowMs / 1000));
      
      if (newCount === null) {
        // Redis operation failed, allow the request
        console.warn('⚠️ Redis operation failed, allowing request');
        return {
          allowed: true,
          remaining: this.config.maxRequests,
          resetTime: now + this.config.windowMs,
        };
      }

      const remaining = Math.max(0, this.config.maxRequests - newCount);
      const resetTime = now + this.config.windowMs;

      return {
        allowed: true,
        remaining,
        resetTime,
      };
    } catch (error) {
      console.error('❌ Rate limit check failed:', error);
      // On error, allow the request
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
      };
    }
  }

  /**
   * Check rate limit for a specific user and action
   */
  async checkUserRateLimit(
    userId: string,
    eventId: string,
    action: string
  ): Promise<RateLimitResult> {
    const identifier = `${eventId}:${userId}`;
    return this.checkRateLimit(identifier, action);
  }

  /**
   * Check rate limit for a specific event
   */
  async checkEventRateLimit(
    eventId: string,
    action: string = 'default'
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(eventId, action);
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async resetRateLimit(identifier: string, action: string = 'default'): Promise<boolean> {
    const key = REDIS_KEYS.RATE_LIMIT(identifier, 'system', action);
    return await this.redis.del(key);
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(
    identifier: string,
    action: string = 'default'
  ): Promise<{
    count: number;
    remaining: number;
    resetTime: number;
    ttl: number;
  }> {
    const key = REDIS_KEYS.RATE_LIMIT(identifier, 'system', action);
    
    const [count, ttl] = await Promise.all([
      this.redis.get<number>(key) || 0,
      this.redis.ttl(key),
    ]);

    const now = Date.now();
    const resetTime = now + (ttl > 0 ? ttl * 1000 : this.config.windowMs);
    const remaining = Math.max(0, this.config.maxRequests - count);

    return {
      count,
      remaining,
      resetTime,
      ttl,
    };
  }

  /**
   * Get rate limit statistics
   */
  async getStatistics(): Promise<{
    totalKeys: number;
    activeRateLimits: number;
    config: RateLimitConfig;
  }> {
    const keys = await this.redis.keys(REDIS_KEYS.RATE_LIMIT('*', '*', '*'));
    
    return {
      totalKeys: keys.length,
      activeRateLimits: keys.length,
      config: this.config,
    };
  }
}

// Predefined rate limiters for different use cases
export const createRateLimiters = () => {
  return {
    // Global rate limiter (per IP)
    global: new RedisRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per 15 minutes
    }),

    // API rate limiter
    api: new RedisRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per 15 minutes
    }),

    // Pusher event rate limiter
    pusher: new RedisRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 events per minute
    }),

    // Song request rate limiter
    songRequest: new RedisRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 requests per minute per user
    }),

    // Admin action rate limiter
    admin: new RedisRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 actions per minute
    }),
  };
};

export const rateLimiters = createRateLimiters();
