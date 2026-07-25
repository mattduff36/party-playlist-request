/**
 * Process-local in-memory rate limiter.
 *
 * Single source of truth for guest submit/search limits without Redis.
 * Call sites should use checkRateLimit() so a Redis-backed implementation
 * can later plug in behind the same interface without rewriting routes.
 *
 * Note: limits are per Node process — multi-instance deploys do not share state.
 */

export type RateLimitBucket = 'songRequest' | 'guestSearch';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  message?: string;
}

interface BucketConfig {
  windowMs: number;
  maxRequests: number;
  /** Minimum ms between successful checks (0 = disabled) */
  cooldownMs: number;
  windowExceededMessage: string;
  cooldownMessage?: string;
}

interface BucketState {
  count: number;
  resetTime: number;
  lastRequest: number;
}

const BUCKET_CONFIGS: Record<RateLimitBucket, BucketConfig> = {
  songRequest: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    cooldownMs: 5 * 1000,
    windowExceededMessage: 'Maximum 10 requests per hour exceeded. Please try again later.',
    cooldownMessage: 'Please wait 5 seconds before making another request.',
  },
  guestSearch: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    cooldownMs: 0,
    windowExceededMessage: 'Too many searches. Please wait a moment and try again.',
  },
};

/** bucket -> identifier -> state */
const stores = new Map<RateLimitBucket, Map<string, BucketState>>();

function getStore(bucket: RateLimitBucket): Map<string, BucketState> {
  let store = stores.get(bucket);
  if (!store) {
    store = new Map();
    stores.set(bucket, store);
  }
  return store;
}

/**
 * Check and record a rate-limit attempt for the given bucket + identifier.
 * Fail-closed: when a limit is exceeded, the request is denied.
 */
export function checkRateLimit(
  bucket: RateLimitBucket,
  identifier: string
): RateLimitResult {
  const config = BUCKET_CONFIGS[bucket];
  const store = getStore(bucket);
  const now = Date.now();
  const current = store.get(identifier) || {
    count: 0,
    resetTime: now + config.windowMs,
    lastRequest: 0,
  };

  if (now > current.resetTime) {
    current.count = 0;
    current.resetTime = now + config.windowMs;
  }

  if (current.count >= config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((current.resetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter,
      message: config.windowExceededMessage,
    };
  }

  if (config.cooldownMs > 0 && now - current.lastRequest < config.cooldownMs) {
    const retryAfter = Math.max(
      1,
      Math.ceil((config.cooldownMs - (now - current.lastRequest)) / 1000)
    );
    return {
      allowed: false,
      remaining: Math.max(0, config.maxRequests - current.count),
      resetTime: current.resetTime,
      retryAfter,
      message: config.cooldownMessage || config.windowExceededMessage,
    };
  }

  current.count += 1;
  current.lastRequest = now;
  store.set(identifier, current);

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - current.count),
    resetTime: current.resetTime,
  };
}

/** Test helper — clears all in-memory rate-limit state. */
export function resetRateLimitStoresForTests(): void {
  stores.clear();
}

export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || '127.0.0.1';
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}
