/**
 * Tests for Event Deduplication Manager
 */

import { EventDeduplicationManager, getDeduplicationManager } from '../deduplication';
import { PusherEvent, EventAction } from '../events';

describe('EventDeduplicationManager', () => {
  let manager: EventDeduplicationManager;

  beforeEach(() => {
    manager = new EventDeduplicationManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('processEvent', () => {
    it('should process new events successfully', async () => {
      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      const result = await manager.processEvent(event);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith(event.payload, event);
    });

    it('should reject duplicate events', async () => {
      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      // Process first time
      const result1 = await manager.processEvent(event);
      expect(result1).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);

      // Process duplicate
      const result2 = await manager.processEvent(event);
      expect(result2).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle out-of-order events', async () => {
      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      const event1: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 3, // Higher version first
        payload: { test: 'data1' },
        eventId: 'event-123'
      };

      const event2: PusherEvent = {
        id: 'test-2',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1, // Lower version second
        payload: { test: 'data2' },
        eventId: 'event-123'
      };

      // Process higher version first
      const result1 = await manager.processEvent(event1);
      expect(result1).toBe(false); // Should be pending

      // Process lower version
      const result2 = await manager.processEvent(event2);
      expect(result2).toBe(true); // Should be processed
      expect(handler).toHaveBeenCalledWith(event2.payload, event2);

      // Higher version should now be processed
      expect(handler).toHaveBeenCalledWith(event1.payload, event1);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle events without handlers', async () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'unknown-action',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      const result = await manager.processEvent(event);
      expect(result).toBe(true); // Should still be processed
    });

    it('should handle handler errors gracefully', async () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      manager.registerHandler('request-submitted', handler);

      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      const result = await manager.processEvent(event);
      expect(result).toBe(true); // Should still be processed
      expect(handler).toHaveBeenCalledWith(event.payload, event);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      const event1: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data1' },
        eventId: 'event-123'
      };

      const event2: PusherEvent = {
        id: 'test-2',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 2,
        payload: { test: 'data2' },
        eventId: 'event-123'
      };

      // Process events
      await manager.processEvent(event1);
      await manager.processEvent(event2);
      await manager.processEvent(event1); // Duplicate

      const stats = manager.getStatistics();
      expect(stats.totalReceived).toBe(3);
      expect(stats.duplicatesDropped).toBe(1);
      expect(stats.processedSuccessfully).toBe(2);
      expect(stats.pendingEventsCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all state', async () => {
      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      await manager.processEvent(event);
      manager.clear();

      const stats = manager.getStatistics();
      expect(stats.totalReceived).toBe(0);
      expect(stats.duplicatesDropped).toBe(0);
      expect(stats.processedSuccessfully).toBe(0);
      expect(stats.pendingEventsCount).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getDeduplicationManager();
      const instance2 = getDeduplicationManager();
      expect(instance1).toBe(instance2);
    });
  });
});
