/**
 * Tests for Pusher Events
 */

import {
  EventAction,
  PusherEvent,
  getEventChannel,
  generateEventId,
  generateEventVersion,
  getEventDeduplicationKey,
  isValidEvent,
  compareEvents
} from '../events';

describe('Pusher Events', () => {
  describe('EventAction', () => {
    it('should have all required event actions', () => {
      const actions: EventAction[] = [
        'request-approved',
        'request-rejected',
        'request-submitted',
        'request-deleted',
        'playback-update',
        'stats-update',
        'queue-update',
        'page-control-toggle',
        'token-expired',
        'admin-login',
        'admin-logout',
        'message-update',
        'message-cleared',
        'event-state-update',
        'event-config-update'
      ];

      actions.forEach(action => {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PusherEvent', () => {
    it('should create a valid PusherEvent', () => {
      const event: PusherEvent = {
        id: 'test-id',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      expect(event.id).toBe('test-id');
      expect(event.action).toBe('request-submitted');
      expect(typeof event.timestamp).toBe('number');
      expect(typeof event.version).toBe('number');
      expect(event.payload).toEqual({ test: 'data' });
      expect(event.eventId).toBe('event-123');
    });
  });

  describe('getEventChannel', () => {
    it('should generate correct channel name', () => {
      const eventId = 'test-event-123';
      const channel = getEventChannel(eventId);
      expect(channel).toBe(`private-party-playlist-${eventId}`);
    });
  });

  describe('generateEventId', () => {
    it('should generate unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });
  });

  describe('generateEventVersion', () => {
    it('should generate increasing versions', () => {
      const version1 = generateEventVersion();
      const version2 = generateEventVersion();
      
      expect(typeof version1).toBe('number');
      expect(typeof version2).toBe('number');
      expect(version2).toBeGreaterThanOrEqual(version1);
    });
  });

  describe('getEventDeduplicationKey', () => {
    it('should generate correct deduplication key', () => {
      const event: PusherEvent = {
        id: 'test-id',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      const key = getEventDeduplicationKey(event);
      expect(key).toBe('event-123-request-submitted-test-id');
    });
  });

  describe('isValidEvent', () => {
    it('should validate correct PusherEvent', () => {
      const validEvent: PusherEvent = {
        id: 'test-id',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      expect(isValidEvent(validEvent)).toBe(true);
    });

    it('should reject invalid events', () => {
      expect(isValidEvent(null)).toBe(false);
      expect(isValidEvent(undefined)).toBe(false);
      expect(isValidEvent({})).toBe(false);
      expect(isValidEvent({ id: 'test' })).toBe(false);
      expect(isValidEvent({ id: 'test', action: 'test' })).toBe(false);
      expect(isValidEvent({ id: 'test', action: 'test', timestamp: 'invalid' })).toBe(false);
    });
  });

  describe('compareEvents', () => {
    it('should compare events by version first', () => {
      const event1: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: 1000,
        version: 1,
        payload: {},
        eventId: 'event-123'
      };

      const event2: PusherEvent = {
        id: 'test-2',
        action: 'request-submitted',
        timestamp: 2000,
        version: 2,
        payload: {},
        eventId: 'event-123'
      };

      expect(compareEvents(event1, event2)).toBeLessThan(0);
      expect(compareEvents(event2, event1)).toBeGreaterThan(0);
    });

    it('should compare events by timestamp when versions are equal', () => {
      const event1: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: 1000,
        version: 1,
        payload: {},
        eventId: 'event-123'
      };

      const event2: PusherEvent = {
        id: 'test-2',
        action: 'request-submitted',
        timestamp: 2000,
        version: 1,
        payload: {},
        eventId: 'event-123'
      };

      expect(compareEvents(event1, event2)).toBeLessThan(0);
      expect(compareEvents(event2, event1)).toBeGreaterThan(0);
    });

    it('should return 0 for identical events', () => {
      const event1: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: 1000,
        version: 1,
        payload: {},
        eventId: 'event-123'
      };

      const event2: PusherEvent = {
        id: 'test-2',
        action: 'request-submitted',
        timestamp: 1000,
        version: 1,
        payload: {},
        eventId: 'event-123'
      };

      expect(compareEvents(event1, event2)).toBe(0);
    });
  });
});
