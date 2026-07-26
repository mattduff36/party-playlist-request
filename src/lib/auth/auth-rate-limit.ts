/**
 * Distributed auth throttling (PRD-02).
 * Uses Upstash Redis when available; production never silently goes unbounded.
 */

import { createHmac } from 'crypto';
import { getRedisClient } from '@/lib/redis/client';

export interface AuthRateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
  remaining: number;
  backend: 'redis' | 'memory' | 'denied';
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

function limiterSalt(): string {
  return (
    process.env.AUTH_RATE_LIMIT_SALT ||
    process.env.IP_SALT ||
    (process.env.NODE_ENV === 'production' ? '' : 'dev-auth-rate-limit-salt')
  );
}

/**
 * Versioned HMAC identifier — never store raw IP/email in limiter keys.
 */
export function hashLimiterId(kind: string, value: string): string {
  const salt = limiterSalt();
  if (!salt && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_RATE_LIMIT_SALT or IP_SALT required in production');
  }
  return createHmac('sha256', salt || 'dev-auth-rate-limit-salt')
    .update(`v1:${kind}:${value.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

function memoryCheck(
  key: string,
  max: number,
  windowMs: number
): AuthRateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: max - 1,
      backend: 'memory',
    };
  }
  if (bucket.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      backend: 'memory',
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, max - bucket.count),
    backend: 'memory',
  };
}

async function redisCheck(
  key: string,
  max: number,
  windowMs: number
): Promise<AuthRateLimitResult | null> {
  const redis = getRedisClient();
  if (!redis.isReady()) {
    try {
      await redis.initialize();
    } catch {
      return null;
    }
  }
  if (!redis.isReady()) return null;

  const fullKey = `auth_rl:v1:${key}`;
  const count = await redis.incrEx(fullKey, Math.ceil(windowMs / 1000));
  if (count === null) return null;

  if (count > max) {
    const ttl = await redis.ttl(fullKey);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: ttl > 0 ? ttl : Math.ceil(windowMs / 1000),
      backend: 'redis',
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - count),
    backend: 'redis',
  };
}

export interface AuthThrottleConfig {
  /** Logical action: login, register, transfer, forgot, reset, check-username */
  action: string;
  ipHash: string;
  accountHash?: string;
  maxPerIp?: number;
  maxPerAccount?: number;
  windowMs?: number;
}

/**
 * Combined per-IP and optional per-account/email throttle.
 */
export async function enforceAuthRateLimit(
  config: AuthThrottleConfig
): Promise<AuthRateLimitResult> {
  const windowMs = config.windowMs ?? 15 * 60 * 1000;
  const maxPerIp = config.maxPerIp ?? 30;
  const maxPerAccount = config.maxPerAccount ?? 10;
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  const ipKey = `${config.action}:ip:${config.ipHash}`;
  let ipResult = await redisCheck(ipKey, maxPerIp, windowMs);

  if (!ipResult) {
    if (isProd && !isTest) {
      // Documented degraded policy: process-local memory limiter (not unbounded).
      console.warn(
        '[auth-rate-limit] Redis unavailable in production — using in-memory degraded limiter'
      );
      ipResult = memoryCheck(ipKey, maxPerIp, windowMs);
    } else {
      ipResult = memoryCheck(ipKey, maxPerIp, windowMs);
    }
  }

  if (!ipResult.allowed) return ipResult;

  if (config.accountHash) {
    const accountKey = `${config.action}:acct:${config.accountHash}`;
    let accountResult = await redisCheck(accountKey, maxPerAccount, windowMs);
    if (!accountResult) {
      accountResult = memoryCheck(accountKey, maxPerAccount, windowMs);
    }
    if (!accountResult.allowed) return accountResult;
    return {
      allowed: true,
      remaining: Math.min(ipResult.remaining, accountResult.remaining),
      backend: accountResult.backend,
    };
  }

  return ipResult;
}

export function resetAuthRateLimitForTests(): void {
  memoryBuckets.clear();
}

export function genericAuthRateLimitResponse(retryAfterSec?: number) {
  return {
    error: 'Too many attempts. Please try again later.',
    code: 'RATE_LIMITED' as const,
    retryAfter: retryAfterSec,
  };
}
