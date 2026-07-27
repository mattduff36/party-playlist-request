/**
 * Distributed guest/auth coordination rate limits (PRD-06).
 * Redis when available; process-local memory when not — never silently unbounded.
 */

import { getRedisClient } from '@/lib/redis/client';
import {
  checkRateLimit,
  resetRateLimitStoresForTests,
  type RateLimitBucket,
  type RateLimitResult,
} from '@/lib/rate-limit';

export type DistributedRateLimitResult = RateLimitResult & {
  backend: 'redis' | 'memory';
};

async function redisCheck(
  key: string,
  max: number,
  windowMs: number
): Promise<DistributedRateLimitResult | null> {
  const redis = getRedisClient();
  if (!redis.isReady()) {
    try {
      await redis.initialize();
    } catch {
      return null;
    }
  }
  if (!redis.isReady()) return null;

  const fullKey = `guest_rl:v1:${key}`;
  const count = await redis.incrEx(fullKey, Math.ceil(windowMs / 1000));
  if (count === null) return null;

  if (count > max) {
    const ttl = await redis.ttl(fullKey);
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + (ttl > 0 ? ttl * 1000 : windowMs),
      retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / 1000),
      message: 'Rate limit exceeded. Please try again later.',
      backend: 'redis',
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - count),
    resetTime: Date.now() + windowMs,
    backend: 'redis',
  };
}

const BUCKET_LIMITS: Record<
  RateLimitBucket,
  { max: number; windowMs: number; cooldownMs: number; message: string }
> = {
  songRequest: {
    max: 10,
    windowMs: 60 * 60 * 1000,
    cooldownMs: 5 * 1000,
    message: 'Maximum 10 requests per hour exceeded. Please try again later.',
  },
  guestSearch: {
    max: 30,
    windowMs: 60 * 1000,
    cooldownMs: 0,
    message: 'Too many searches. Please wait a moment and try again.',
  },
  accessCodeVerify: {
    max: 30,
    windowMs: 15 * 60 * 1000,
    cooldownMs: 500,
    message: 'Too many access code attempts. Please try again later.',
  },
};

export interface GuestThrottleInput {
  bucket: RateLimitBucket;
  /** Primary key: eventId + guest device id */
  primaryKey: string;
  /** Secondary abuse signal (IP hash) — higher ceiling */
  secondaryKey?: string;
  secondaryMaxMultiplier?: number;
}

/**
 * Primary limit by event+guest device; secondary IP hash as abuse signal.
 * Fail policy: Redis → memory (never unbounded).
 */
export async function enforceGuestRateLimit(
  input: GuestThrottleInput
): Promise<DistributedRateLimitResult> {
  const cfg = BUCKET_LIMITS[input.bucket];
  const primaryRedisKey = `${input.bucket}:guest:${input.primaryKey}`;

  let primary = await redisCheck(primaryRedisKey, cfg.max, cfg.windowMs);
  if (!primary) {
    const mem = checkRateLimit(input.bucket, `mem:${input.primaryKey}`);
    primary = { ...mem, backend: 'memory' };
  } else if (!primary.allowed) {
    primary.message = cfg.message;
    return primary;
  }

  if (!primary.allowed) {
    primary.message = cfg.message;
    return primary;
  }

  if (input.secondaryKey) {
    const secondaryMax =
      cfg.max * (input.secondaryMaxMultiplier ?? 15);
    const secondaryKey = `${input.bucket}:ip:${input.secondaryKey}`;
    let secondary = await redisCheck(secondaryKey, secondaryMax, cfg.windowMs);
    if (!secondary) {
      // Memory fallback must use the secondary ceiling — not the tiny primary max —
      // so many guests behind one NAT stay fair when Redis is down.
      const mem = checkRateLimit(
        input.bucket,
        `mem-ip:${input.bucket}:${input.secondaryKey}`,
        { maxRequests: secondaryMax, cooldownMs: 0 }
      );
      secondary = { ...mem, backend: 'memory' };
    }
    if (!secondary.allowed) {
      return {
        ...secondary,
        message:
          'Too many requests from this network. Please try again later.',
      };
    }
  }

  return primary;
}

export function resetDistributedRateLimitForTests(): void {
  resetRateLimitStoresForTests();
}
