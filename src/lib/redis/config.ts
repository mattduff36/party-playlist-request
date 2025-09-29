/**
 * Redis Configuration
 * 
 * This module provides configuration for Upstash Redis integration
 * for rate limiting and caching functionality.
 */

export interface RedisConfig {
  url: string;
  token: string;
  ttl: {
    rateLimit: number; // TTL for rate limit counters (seconds)
    cache: number; // TTL for cached data (seconds)
    session: number; // TTL for session data (seconds)
  };
  limits: {
    maxConnections: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  ttl: {
    rateLimit: 3600, // 1 hour
    cache: 1800, // 30 minutes
    session: 86400, // 24 hours
  },
  limits: {
    maxConnections: 10,
    retryAttempts: 3,
    retryDelay: 1000,
  },
};

export const REDIS_KEYS = {
  RATE_LIMIT: (eventId: string, userId: string, action: string) => 
    `rate_limit:${eventId}:${userId}:${action}`,
  CACHE: (key: string) => `cache:${key}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  EVENT_STATE: (eventId: string) => `event_state:${eventId}`,
  USER_ACTIVITY: (eventId: string, userId: string) => `user_activity:${eventId}:${userId}`,
  PUSHER_EVENTS: (eventId: string) => `pusher_events:${eventId}`,
} as const;

export const REDIS_PATTERNS = {
  RATE_LIMIT_ALL: 'rate_limit:*',
  CACHE_ALL: 'cache:*',
  SESSION_ALL: 'session:*',
  EVENT_STATE_ALL: 'event_state:*',
  USER_ACTIVITY_ALL: 'user_activity:*',
  PUSHER_EVENTS_ALL: 'pusher_events:*',
} as const;
