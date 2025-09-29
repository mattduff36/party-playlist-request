/**
 * Vercel KV Configuration
 * 
 * This module provides configuration for Vercel KV integration
 * for caching frequently accessed data.
 */

export interface VercelKVConfig {
  url: string;
  token: string;
  ttl: {
    events: number; // TTL for event data (seconds)
    users: number; // TTL for user data (seconds)
    spotify: number; // TTL for Spotify data (seconds)
    sessions: number; // TTL for session data (seconds)
    requests: number; // TTL for song requests (seconds)
  };
  limits: {
    maxKeys: number;
    maxValueSize: number; // in bytes
    batchSize: number;
  };
}

export const DEFAULT_VERCEL_KV_CONFIG: VercelKVConfig = {
  url: process.env.KV_URL || '',
  token: process.env.KV_REST_API_URL || '',
  ttl: {
    events: 300, // 5 minutes
    users: 900, // 15 minutes
    spotify: 600, // 10 minutes
    sessions: 3600, // 1 hour
    requests: 1800, // 30 minutes
  },
  limits: {
    maxKeys: 1000,
    maxValueSize: 1024 * 1024, // 1MB
    batchSize: 100,
  },
};

export const KV_KEYS = {
  EVENT: (eventId: string) => `event:${eventId}`,
  USER: (userId: string) => `user:${userId}`,
  SPOTIFY_DEVICE: (userId: string) => `spotify:device:${userId}`,
  SPOTIFY_TOKEN: (userId: string) => `spotify:token:${userId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  REQUEST: (requestId: string) => `request:${requestId}`,
  REQUESTS_BY_EVENT: (eventId: string) => `requests:event:${eventId}`,
  REQUESTS_BY_USER: (userId: string) => `requests:user:${userId}`,
  EVENT_STATS: (eventId: string) => `stats:event:${eventId}`,
  USER_STATS: (userId: string) => `stats:user:${userId}`,
} as const;

export const KV_PATTERNS = {
  EVENTS: 'event:*',
  USERS: 'user:*',
  SPOTIFY_DEVICES: 'spotify:device:*',
  SPOTIFY_TOKENS: 'spotify:token:*',
  SESSIONS: 'session:*',
  REQUESTS: 'request:*',
  REQUESTS_BY_EVENT: 'requests:event:*',
  REQUESTS_BY_USER: 'requests:user:*',
  EVENT_STATS: 'stats:event:*',
  USER_STATS: 'stats:user:*',
} as const;
