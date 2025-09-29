/**
 * Tests for Rate Limiter
 */

import { RateLimiter, getRateLimiter, RateLimitConfig } from '../rate-limiter';
import { PusherEvent, EventAction } from '../events';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      globalMaxEventsPerSecond: 2,
      globalMaxEventsPerMinute: 10,
      globalMaxEventsPerHour: 100,
      userMaxEventsPerSecond: 1,
      userMaxEventsPerMinute: 5,
      userMaxEventsPerHour: 50,
      eventMaxEventsPerSecond: 1,
      eventMaxEventsPerMinute: 5,
      eventMaxEventsPerHour: 50,
      actionMaxEventsPerSecond: 1,
      actionMaxEventsPerMinute: 5,
      actionMaxEventsPerHour: 50,
      burstLimit: 2,
      burstWindow: 1000,
      enablePenalties: true,
      penaltyDuration: 1000,
      maxPenaltyLevel: 3,
      cleanupInterval: 10000,
      maxHistorySize: 1000
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('checkRateLimit', () => {
    it('should allow events within limits', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result.allowed).toBe(true);
    });

    it('should block events exceeding global limits', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send events up to global limit
      for (let i = 0; i < 2; i++) {
        const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
        expect(result.allowed).toBe(true);
      }

      // Next event should be blocked
      const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global rate limit exceeded');
    });

    it('should block events exceeding user limits', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send event up to user limit
      const result1 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Next event should be blocked
      const result2 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('User rate limit exceeded');
    });

    it('should block events exceeding event limits', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send event up to event limit
      const result1 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Next event should be blocked
      const result2 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('Event rate limit exceeded');
    });

    it('should block events exceeding action limits', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send event up to action limit
      const result1 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Next event should be blocked
      const result2 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('Action rate limit exceeded');
    });

    it('should block events exceeding burst limits', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send events up to burst limit
      for (let i = 0; i < 2; i++) {
        const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
        expect(result.allowed).toBe(true);
      }

      // Next event should be blocked
      const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Burst rate limit exceeded');
    });

    it('should apply penalties for repeated violations', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send event up to user limit
      const result1 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Next event should be blocked and penalty applied
      const result2 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result2.allowed).toBe(false);
      expect(result2.penaltyLevel).toBe(1);

      // Further events should be blocked due to penalty
      const result3 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toContain('User under penalty');
    });

    it('should allow events from different users', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send event from user 1
      const result1 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Send event from user 2 (should be allowed)
      const result2 = limiter.checkRateLimit(event, 'user-2', 'event-123');
      expect(result2.allowed).toBe(true);
    });

    it('should allow events from different events', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send event to event 1
      const result1 = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Send event to event 2 (should be allowed)
      const result2 = limiter.checkRateLimit(event, 'user-1', 'event-456');
      expect(result2.allowed).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Send some events
      limiter.checkRateLimit(event, 'user-1', 'event-123');
      limiter.checkRateLimit(event, 'user-1', 'event-123'); // Should be blocked

      const stats = limiter.getStatistics();
      expect(stats.totalRequests).toBe(2);
      expect(stats.blockedRequests).toBe(1);
      expect(stats.global.perSecond).toBe(2);
    });
  });

  describe('resetUserPenalty', () => {
    it('should reset user penalty', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Trigger penalty
      limiter.checkRateLimit(event, 'user-1', 'event-123');
      limiter.checkRateLimit(event, 'user-1', 'event-123'); // Should trigger penalty

      // Reset penalty
      limiter.resetUserPenalty('user-1');

      // Should now be allowed
      const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
      expect(result.allowed).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig: Partial<RateLimitConfig> = {
        userMaxEventsPerSecond: 5
      };

      limiter.updateConfig(newConfig);

      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Should now allow more events per second
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkRateLimit(event, 'user-1', 'event-123');
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getRateLimiter();
      const instance2 = getRateLimiter();
      expect(instance1).toBe(instance2);
    });
  });
});
