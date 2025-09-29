/**
 * Redis Rate Limiter Tests
 */

import { RedisRateLimiter, createRateLimiters } from '../rate-limiter';
import { getRedisClient } from '../client';

// Mock Redis client
jest.mock('../client', () => ({
  getRedisClient: jest.fn(() => ({
    isReady: jest.fn().mockReturnValue(true),
    get: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue(true),
    incrEx: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    del: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue(['rate_limit:test:system:default']),
  })),
}));

describe('RedisRateLimiter', () => {
  let rateLimiter: RedisRateLimiter;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = getRedisClient();
    rateLimiter = new RedisRateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 10,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rate limit checking', () => {
    it('should allow request when under limit', async () => {
      mockRedis.get.mockResolvedValue(5);
      mockRedis.incrEx.mockResolvedValue(6);

      const result = await rateLimiter.checkRateLimit('test-user', 'default');

      expect(result).toEqual({
        allowed: true,
        remaining: 4,
        resetTime: expect.any(Number),
      });
    });

    it('should block request when over limit', async () => {
      mockRedis.get.mockResolvedValue(10);
      mockRedis.ttl.mockResolvedValue(30);

      const result = await rateLimiter.checkRateLimit('test-user', 'default');

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        resetTime: expect.any(Number),
        retryAfter: expect.any(Number),
      });
    });

    it('should handle Redis unavailability gracefully', async () => {
      mockRedis.isReady.mockReturnValue(false);

      const result = await rateLimiter.checkRateLimit('test-user', 'default');

      expect(result).toEqual({
        allowed: true,
        remaining: 10,
        resetTime: expect.any(Number),
      });
    });

    it('should handle Redis operation failures', async () => {
      mockRedis.incrEx.mockResolvedValue(null);

      const result = await rateLimiter.checkRateLimit('test-user', 'default');

      expect(result).toEqual({
        allowed: true,
        remaining: 10,
        resetTime: expect.any(Number),
      });
    });
  });

  describe('user rate limiting', () => {
    it('should check rate limit for specific user and action', async () => {
      mockRedis.get.mockResolvedValue(3);
      mockRedis.incrEx.mockResolvedValue(4);

      const result = await rateLimiter.checkUserRateLimit('user123', 'event456', 'song_request');

      expect(result).toEqual({
        allowed: true,
        remaining: 6,
        resetTime: expect.any(Number),
      });
    });
  });

  describe('event rate limiting', () => {
    it('should check rate limit for specific event', async () => {
      mockRedis.get.mockResolvedValue(2);
      mockRedis.incrEx.mockResolvedValue(3);

      const result = await rateLimiter.checkEventRateLimit('event456', 'broadcast');

      expect(result).toEqual({
        allowed: true,
        remaining: 7,
        resetTime: expect.any(Number),
      });
    });
  });

  describe('rate limit management', () => {
    it('should reset rate limit for identifier', async () => {
      const result = await rateLimiter.resetRateLimit('test-user', 'default');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:test-user:system:default');
    });

    it('should get rate limit status', async () => {
      mockRedis.get.mockResolvedValue(5);
      mockRedis.ttl.mockResolvedValue(30);

      const result = await rateLimiter.getRateLimitStatus('test-user', 'default');

      expect(result).toEqual({
        count: 5,
        remaining: 5,
        resetTime: expect.any(Number),
        ttl: 30,
      });
    });
  });

  describe('statistics', () => {
    it('should return rate limiter statistics', async () => {
      const stats = await rateLimiter.getStatistics();

      expect(stats).toEqual({
        totalKeys: 1,
        activeRateLimits: 1,
        config: {
          windowMs: 60000,
          maxRequests: 10,
          skipSuccessfulRequests: false,
          skipFailedRequests: false,
        },
      });
    });
  });
});

describe('createRateLimiters', () => {
  it('should create predefined rate limiters', () => {
    const limiters = createRateLimiters();

    expect(limiters).toHaveProperty('global');
    expect(limiters).toHaveProperty('api');
    expect(limiters).toHaveProperty('pusher');
    expect(limiters).toHaveProperty('songRequest');
    expect(limiters).toHaveProperty('admin');

    expect(limiters.global).toBeInstanceOf(RedisRateLimiter);
    expect(limiters.api).toBeInstanceOf(RedisRateLimiter);
    expect(limiters.pusher).toBeInstanceOf(RedisRateLimiter);
    expect(limiters.songRequest).toBeInstanceOf(RedisRateLimiter);
    expect(limiters.admin).toBeInstanceOf(RedisRateLimiter);
  });

  it('should have correct configurations for each limiter', () => {
    const limiters = createRateLimiters();

    // Global rate limiter
    expect(limiters.global['config']).toEqual({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });

    // API rate limiter
    expect(limiters.api['config']).toEqual({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });

    // Pusher rate limiter
    expect(limiters.pusher['config']).toEqual({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });

    // Song request rate limiter
    expect(limiters.songRequest['config']).toEqual({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });

    // Admin rate limiter
    expect(limiters.admin['config']).toEqual({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });
  });
});
