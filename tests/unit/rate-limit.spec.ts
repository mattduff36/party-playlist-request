/**
 * In-memory rate limiter unit tests
 */

import {
  checkRateLimit,
  resetRateLimitStoresForTests,
} from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitStoresForTests();
  });

  it('allows requests under the songRequest limit', () => {
    const result = checkRateLimit('songRequest', 'ip-a');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('enforces songRequest cooldown between requests', () => {
    expect(checkRateLimit('songRequest', 'ip-b').allowed).toBe(true);
    const second = checkRateLimit('songRequest', 'ip-b');
    expect(second.allowed).toBe(false);
    expect(second.message).toMatch(/5 seconds/i);
  });

  it('enforces guestSearch window of 30 per minute', () => {
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit('guestSearch', 'searcher').allowed).toBe(true);
    }
    const blocked = checkRateLimit('guestSearch', 'searcher');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('isolates identifiers', () => {
    expect(checkRateLimit('guestSearch', 'user-1').allowed).toBe(true);
    expect(checkRateLimit('guestSearch', 'user-2').allowed).toBe(true);
  });
});
