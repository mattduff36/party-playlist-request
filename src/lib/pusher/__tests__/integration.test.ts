/**
 * Integration Tests for Pusher System
 */

import { CentralizedPusherClient } from '../client';
import { EventManager, getEventManager } from '../event-manager';
import { EventDeduplicationManager, getDeduplicationManager } from '../deduplication';
import { ReconnectionManager, getReconnectionManager } from '../reconnection';
import { FallbackManager, getFallbackManager } from '../fallback';
import { StateBroadcaster, getStateBroadcaster } from '../state-broadcaster';
import { RateLimiter, getRateLimiter } from '../rate-limiter';
import { PusherEvent, EventAction } from '../events';

// Mock Pusher client
jest.mock('pusher-js', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      subscribe: jest.fn().mockReturnValue({
        bind: jest.fn(),
        unbind: jest.fn()
      }),
      unsubscribe: jest.fn(),
      disconnect: jest.fn(),
      connection: {
        state: 'connected'
      }
    }))
  };
});

// Mock broadcaster
jest.mock('../broadcaster', () => ({
  broadcastEvent: jest.fn()
}));

describe('Pusher System Integration', () => {
  let client: CentralizedPusherClient;
  let eventManager: EventManager;
  let deduplicationManager: EventDeduplicationManager;
  let reconnectionManager: ReconnectionManager;
  let fallbackManager: FallbackManager;
  let stateBroadcaster: StateBroadcaster;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create fresh instances for each test
    client = new CentralizedPusherClient();
    eventManager = new EventManager(client);
    deduplicationManager = new EventDeduplicationManager();
    reconnectionManager = new ReconnectionManager();
    fallbackManager = new FallbackManager();
    stateBroadcaster = new StateBroadcaster();
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    client.destroy?.();
    eventManager = null as any;
    deduplicationManager.clear();
    reconnectionManager.destroy();
    fallbackManager.destroy();
    stateBroadcaster.destroy();
    rateLimiter.destroy();
  });

  describe('Event Flow Integration', () => {
    it('should process events through the complete pipeline', async () => {
      const eventHandler = jest.fn();
      const stateHandler = jest.fn();

      // Set up event handlers
      eventManager.on('request-submitted', eventHandler);
      stateBroadcaster.registerHandler('request-submitted', stateHandler);

      // Initialize components
      await client.initialize('event-123');
      await fallbackManager.initialize('event-123');
      await stateBroadcaster.initialize('event-123');

      // Create test event
      const testEvent: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { songName: 'Test Song', artistName: 'Test Artist' },
        eventId: 'event-123'
      };

      // Process event through deduplication manager
      const processed = await deduplicationManager.processEvent(testEvent);
      expect(processed).toBe(true);

      // Verify event was processed
      expect(eventHandler).toHaveBeenCalledWith(testEvent.payload, testEvent);
      expect(stateHandler).toHaveBeenCalledWith(testEvent);
    });

    it('should handle duplicate events correctly', async () => {
      const eventHandler = jest.fn();
      eventManager.on('request-submitted', eventHandler);

      const testEvent: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { songName: 'Test Song', artistName: 'Test Artist' },
        eventId: 'event-123'
      };

      // Process event first time
      const result1 = await deduplicationManager.processEvent(testEvent);
      expect(result1).toBe(true);
      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Process same event again
      const result2 = await deduplicationManager.processEvent(testEvent);
      expect(result2).toBe(false);
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle out-of-order events correctly', async () => {
      const eventHandler = jest.fn();
      eventManager.on('request-submitted', eventHandler);

      const event1: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 3,
        payload: { songName: 'Song 1', artistName: 'Artist 1' },
        eventId: 'event-123'
      };

      const event2: PusherEvent = {
        id: 'test-2',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { songName: 'Song 2', artistName: 'Artist 2' },
        eventId: 'event-123'
      };

      // Process higher version first
      const result1 = await deduplicationManager.processEvent(event1);
      expect(result1).toBe(false); // Should be pending

      // Process lower version
      const result2 = await deduplicationManager.processEvent(event2);
      expect(result2).toBe(true); // Should be processed

      // Both events should eventually be processed
      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits across the system', async () => {
      const eventHandler = jest.fn();
      eventManager.on('request-submitted', eventHandler);

      // Create rate limiter with low limits
      const strictRateLimiter = new RateLimiter({
        globalMaxEventsPerSecond: 2,
        userMaxEventsPerSecond: 1,
        eventMaxEventsPerSecond: 1,
        actionMaxEventsPerSecond: 1
      });

      const testEvent: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { songName: 'Test Song', artistName: 'Test Artist' },
        eventId: 'event-123'
      };

      // First event should be allowed
      const result1 = strictRateLimiter.checkRateLimit(testEvent, 'user-1', 'event-123');
      expect(result1.allowed).toBe(true);

      // Second event should be blocked
      const result2 = strictRateLimiter.checkRateLimit(testEvent, 'user-1', 'event-123');
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('User rate limit exceeded');

      strictRateLimiter.destroy();
    });
  });

  describe('Fallback Integration', () => {
    it('should handle connection failures gracefully', async () => {
      const eventHandler = jest.fn();
      fallbackManager.registerHandler('request-submitted', eventHandler);

      await fallbackManager.initialize('event-123');

      // Simulate connection failure
      await fallbackManager.handleConnectionFailure();

      // Should activate polling mode
      expect(fallbackManager.getState().mode).toBe('polling');

      // Queue an event
      const testEvent: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { songName: 'Test Song', artistName: 'Test Artist' },
        eventId: 'event-123'
      };

      fallbackManager.queueEvent(testEvent, 'high');

      // Process queued events
      await fallbackManager.processQueuedEvents();

      expect(eventHandler).toHaveBeenCalledWith(testEvent);
    });

    it('should restore normal operation after reconnection', async () => {
      await fallbackManager.initialize('event-123');

      // Simulate connection failure
      await fallbackManager.handleConnectionFailure();
      expect(fallbackManager.getState().mode).toBe('polling');

      // Simulate successful reconnection
      await fallbackManager.handleConnectionSuccess();
      expect(fallbackManager.getState().mode).toBe('pusher');
      expect(fallbackManager.getState().consecutiveFailures).toBe(0);
    });
  });

  describe('State Broadcasting Integration', () => {
    it('should broadcast state changes correctly', async () => {
      await stateBroadcaster.initialize('event-123');

      // Mock broadcastEvent
      const { broadcastEvent } = require('../broadcaster');
      broadcastEvent.mockClear();

      // Broadcast event status change
      await stateBroadcaster.broadcastEventStatusChange('offline', 'standby', 'system');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(broadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'event-state-update',
        expect.objectContaining({
          type: 'event-status-change',
          oldValue: 'offline',
          newValue: 'standby',
          source: 'system'
        })
      );
    });

    it('should handle batch broadcasting', async () => {
      await stateBroadcaster.initialize('event-123');

      const { broadcastEvent } = require('../broadcaster');
      broadcastEvent.mockClear();

      const changes = [
        {
          payload: {
            type: 'event-status-change' as const,
            oldValue: 'offline',
            newValue: 'standby',
            timestamp: Date.now(),
            source: 'system' as const
          },
          pusherAction: 'event-state-update' as EventAction
        },
        {
          payload: {
            type: 'page-enablement-change' as const,
            oldValue: false,
            newValue: true,
            timestamp: Date.now(),
            source: 'admin' as const,
            metadata: { page: 'requests' }
          },
          pusherAction: 'page-control-toggle' as EventAction
        }
      ];

      await stateBroadcaster.broadcastBatch(changes);

      expect(broadcastEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully across components', async () => {
      const errorHandler = jest.fn();
      eventManager.on('request-submitted', errorHandler);

      // Create event with invalid handler
      const testEvent: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { songName: 'Test Song', artistName: 'Test Artist' },
        eventId: 'event-123'
      };

      // Mock handler to throw error
      errorHandler.mockImplementation(() => {
        throw new Error('Handler error');
      });

      // Process event - should not throw
      const result = await deduplicationManager.processEvent(testEvent);
      expect(result).toBe(true);
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Statistics Integration', () => {
    it('should provide comprehensive statistics', async () => {
      await client.initialize('event-123');
      await fallbackManager.initialize('event-123');
      await stateBroadcaster.initialize('event-123');

      const clientStats = client.getEventStats();
      const fallbackStats = fallbackManager.getStatistics();
      const stateStats = stateBroadcaster.getStatistics();
      const rateStats = rateLimiter.getStatistics();

      expect(clientStats).toHaveProperty('processed');
      expect(clientStats).toHaveProperty('deduplication');
      expect(clientStats).toHaveProperty('reconnection');
      expect(clientStats).toHaveProperty('rateLimiting');

      expect(fallbackStats).toHaveProperty('state');
      expect(fallbackStats).toHaveProperty('queueLength');

      expect(stateStats).toHaveProperty('config');
      expect(stateStats).toHaveProperty('pendingCount');

      expect(rateStats).toHaveProperty('totalRequests');
      expect(rateStats).toHaveProperty('blockedRequests');
    });
  });

  describe('Cleanup Integration', () => {
    it('should clean up all resources properly', async () => {
      await client.initialize('event-123');
      await fallbackManager.initialize('event-123');
      await stateBroadcaster.initialize('event-123');

      // Destroy all components
      await client.disconnect();
      fallbackManager.destroy();
      stateBroadcaster.destroy();
      rateLimiter.destroy();

      // Verify cleanup
      expect(fallbackManager.isActive()).toBe(false);
      expect(stateBroadcaster.getStatistics().isDestroyed).toBe(true);
    });
  });
});
