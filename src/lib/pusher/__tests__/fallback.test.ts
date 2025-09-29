/**
 * Tests for Fallback Manager
 */

import { FallbackManager, getFallbackManager, FallbackConfig } from '../fallback';
import { PusherEvent, EventAction } from '../events';

// Mock fetch for polling tests
global.fetch = jest.fn();

describe('FallbackManager', () => {
  let manager: FallbackManager;

  beforeEach(() => {
    manager = new FallbackManager({
      enablePolling: true,
      enableLocalStorage: true,
      enableGracefulDegradation: true,
      pollingInterval: 100,
      maxPollingAttempts: 3,
      localStorageKey: 'test-pusher-fallback',
      localStorageExpiry: 1000,
      degradationTimeout: 500,
      retryAfterFailure: true,
      maxRetryAttempts: 2
    });
  });

  afterEach(() => {
    manager.destroy();
    localStorage.clear();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(manager.initialize('event-123')).resolves.not.toThrow();
      expect(manager.isActive()).toBe(true);
    });
  });

  describe('handleConnectionFailure', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should activate polling mode on first failure', async () => {
      await manager.handleConnectionFailure();
      expect(manager.getState().mode).toBe('polling');
    });

    it('should activate localStorage mode after max polling attempts', async () => {
      // Mock polling to fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Polling failed'));

      await manager.handleConnectionFailure();
      
      // Wait for polling attempts to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(manager.getState().mode).toBe('localStorage');
    });

    it('should activate degraded mode when all else fails', async () => {
      const managerWithoutFallbacks = new FallbackManager({
        enablePolling: false,
        enableLocalStorage: false,
        enableGracefulDegradation: true
      });

      await managerWithoutFallbacks.initialize('event-123');
      await managerWithoutFallbacks.handleConnectionFailure();
      
      expect(managerWithoutFallbacks.getState().mode).toBe('degraded');
      
      managerWithoutFallbacks.destroy();
    });
  });

  describe('handleConnectionSuccess', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
      await manager.handleConnectionFailure();
    });

    it('should restore pusher mode on success', async () => {
      await manager.handleConnectionSuccess();
      expect(manager.getState().mode).toBe('pusher');
      expect(manager.getState().consecutiveFailures).toBe(0);
    });
  });

  describe('queueEvent', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should queue events successfully', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      manager.queueEvent(event, 'high');
      expect(manager.getState().eventsInQueue).toBe(1);
    });

    it('should store events in localStorage when enabled', () => {
      const event: PusherEvent = {
        id: 'test-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'data' },
        eventId: 'event-123'
      };

      manager.queueEvent(event, 'high');
      
      const stored = localStorage.getItem('test-pusher-fallback');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('test-1');
    });
  });

  describe('registerHandler', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should register and call handlers', async () => {
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

      manager.queueEvent(event, 'high');
      await manager.processQueuedEvents();

      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('polling', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should poll for events successfully', async () => {
      const mockEvents = [
        {
          id: 'polled-1',
          action: 'request-submitted',
          timestamp: Date.now(),
          version: 1,
          payload: { test: 'polled' },
          eventId: 'event-123'
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ events: mockEvents })
      });

      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      await manager.activatePollingMode();
      
      // Wait for polling to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(handler).toHaveBeenCalled();
    });

    it('should handle polling failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Polling failed'));

      await manager.activatePollingMode();
      
      // Wait for polling attempts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(manager.getState().mode).toBe('localStorage');
    });
  });

  describe('localStorage fallback', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should process events from localStorage', async () => {
      const event: PusherEvent = {
        id: 'stored-1',
        action: 'request-submitted',
        timestamp: Date.now(),
        version: 1,
        payload: { test: 'stored' },
        eventId: 'event-123'
      };

      // Store event in localStorage
      localStorage.setItem('test-pusher-fallback', JSON.stringify([{
        ...event,
        storedAt: Date.now()
      }]));

      const handler = jest.fn();
      manager.registerHandler('request-submitted', handler);

      await manager.activateLocalStorageMode();
      
      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('degraded mode', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should activate degraded mode', async () => {
      await manager.activateDegradedMode();
      expect(manager.getState().mode).toBe('degraded');
    });

    it('should trigger degradation timeout', async () => {
      const handler = jest.fn();
      manager.registerHandler('error_occurred', handler);

      await manager.activateDegradedMode();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should return correct statistics', () => {
      const stats = manager.getStatistics();
      expect(stats.state.isActive).toBe(true);
      expect(stats.queueLength).toBe(0);
      expect(stats.config.enablePolling).toBe(true);
    });
  });

  describe('forceRetry', () => {
    beforeEach(async () => {
      await manager.initialize('event-123');
    });

    it('should force retry polling', async () => {
      await manager.forceRetry();
      expect(manager.getState().mode).toBe('polling');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getFallbackManager();
      const instance2 = getFallbackManager();
      expect(instance1).toBe(instance2);
    });
  });
});
