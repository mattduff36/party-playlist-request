/**
 * Tests for State Broadcaster
 */

import { StateBroadcaster, getStateBroadcaster, StateChangePayload } from '../state-broadcaster';
import { EventAction } from '../events';

// Mock the broadcaster module
jest.mock('../broadcaster', () => ({
  broadcastEvent: jest.fn()
}));

import { broadcastEvent } from '../broadcaster';

describe('StateBroadcaster', () => {
  let broadcaster: StateBroadcaster;
  const mockBroadcastEvent = broadcastEvent as jest.MockedFunction<typeof broadcastEvent>;

  beforeEach(() => {
    broadcaster = new StateBroadcaster({
      enableStateBroadcasting: true,
      enableUserActionBroadcasting: true,
      enableSystemEventBroadcasting: true,
      enableAdminActionBroadcasting: true,
      debounceDelay: 10,
      batchSize: 5,
      maxRetries: 3
    });
    mockBroadcastEvent.mockClear();
  });

  afterEach(() => {
    broadcaster.destroy();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(broadcaster.initialize('event-123')).resolves.not.toThrow();
    });
  });

  describe('broadcastEventStatusChange', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast event status change', async () => {
      await broadcaster.broadcastEventStatusChange('offline', 'standby', 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
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

    it('should not broadcast when disabled', async () => {
      broadcaster.updateConfig({ enableStateBroadcasting: false });
      
      await broadcaster.broadcastEventStatusChange('offline', 'standby', 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).not.toHaveBeenCalled();
    });
  });

  describe('broadcastPageEnablementChange', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast page enablement change', async () => {
      await broadcaster.broadcastPageEnablementChange('requests', true, 'admin');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'page-control-toggle',
        expect.objectContaining({
          type: 'page-enablement-change',
          oldValue: false,
          newValue: true,
          source: 'admin',
          metadata: { page: 'requests' }
        })
      );
    });
  });

  describe('broadcastEventConfigChange', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast event config change', async () => {
      const oldConfig = { name: 'Old Event' };
      const newConfig = { name: 'New Event' };
      
      await broadcaster.broadcastEventConfigChange(oldConfig, newConfig, 'user');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'event-config-update',
        expect.objectContaining({
          type: 'event-config-change',
          oldValue: oldConfig,
          newValue: newConfig,
          source: 'user'
        })
      );
    });
  });

  describe('broadcastLoadingStateChange', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast loading state change', async () => {
      await broadcaster.broadcastLoadingStateChange(true, 'RequestForm', 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'message-update',
        expect.objectContaining({
          type: 'loading-state-change',
          oldValue: false,
          newValue: true,
          source: 'system',
          metadata: { component: 'RequestForm' }
        })
      );
    });
  });

  describe('broadcastErrorStateChange', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast error state change', async () => {
      const error = new Error('Test error');
      await broadcaster.broadcastErrorStateChange(error, 'RequestForm', 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'message-update',
        expect.objectContaining({
          type: 'error-state-change',
          oldValue: null,
          newValue: {
            message: 'Test error',
            stack: error.stack,
            name: 'Error'
          },
          source: 'system',
          metadata: { component: 'RequestForm' }
        })
      );
    });

    it('should broadcast null error state', async () => {
      await broadcaster.broadcastErrorStateChange(null, 'RequestForm', 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'message-update',
        expect.objectContaining({
          type: 'error-state-change',
          oldValue: null,
          newValue: null,
          source: 'system',
          metadata: { component: 'RequestForm' }
        })
      );
    });
  });

  describe('broadcastUserAction', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast user action', async () => {
      const actionData = { songName: 'Test Song', artistName: 'Test Artist' };
      
      await broadcaster.broadcastUserAction('song-request', actionData, 'user');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'message-update',
        expect.objectContaining({
          type: 'user-action-change',
          oldValue: null,
          newValue: actionData,
          source: 'user',
          metadata: { action: 'song-request' }
        })
      );
    });

    it('should not broadcast when disabled', async () => {
      broadcaster.updateConfig({ enableUserActionBroadcasting: false });
      
      await broadcaster.broadcastUserAction('song-request', {}, 'user');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).not.toHaveBeenCalled();
    });
  });

  describe('broadcastSystemEvent', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast system event', async () => {
      const eventData = { message: 'System maintenance' };
      
      await broadcaster.broadcastSystemEvent('maintenance', eventData, 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'message-update',
        expect.objectContaining({
          type: 'user-action-change',
          oldValue: null,
          newValue: eventData,
          source: 'system',
          metadata: { action: 'maintenance', isSystemEvent: true }
        })
      );
    });
  });

  describe('broadcastAdminAction', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast admin action', async () => {
      const actionData = { action: 'ban-user', userId: 'user-123' };
      
      await broadcaster.broadcastAdminAction('ban-user', actionData, 'admin');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'admin-login',
        expect.objectContaining({
          type: 'user-action-change',
          oldValue: null,
          newValue: actionData,
          source: 'admin',
          metadata: { action: 'ban-user', isAdminAction: true }
        })
      );
    });
  });

  describe('broadcastImmediate', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast immediately without debouncing', async () => {
      const payload: StateChangePayload = {
        type: 'event-status-change',
        oldValue: 'offline',
        newValue: 'standby',
        timestamp: Date.now(),
        source: 'system'
      };

      await broadcaster.broadcastImmediate(payload, 'event-state-update');
      
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'event-state-update',
        payload
      );
    });
  });

  describe('broadcastBatch', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should broadcast batch of changes', async () => {
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

      await broadcaster.broadcastBatch(changes);
      
      expect(mockBroadcastEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('debouncing', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should debounce multiple rapid calls', async () => {
      // Make multiple rapid calls
      await broadcaster.broadcastEventStatusChange('offline', 'standby', 'system');
      await broadcaster.broadcastEventStatusChange('standby', 'live', 'system');
      await broadcaster.broadcastEventStatusChange('live', 'offline', 'system');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should only broadcast the last call
      expect(mockBroadcastEvent).toHaveBeenCalledTimes(1);
      expect(mockBroadcastEvent).toHaveBeenCalledWith(
        'event-123',
        'event-state-update',
        expect.objectContaining({
          newValue: 'offline'
        })
      );
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should return correct statistics', () => {
      const stats = broadcaster.getStatistics();
      expect(stats.config.enableStateBroadcasting).toBe(true);
      expect(stats.pendingCount).toBe(0);
      expect(stats.eventId).toBe('event-123');
      expect(stats.isDestroyed).toBe(false);
    });
  });

  describe('clearPendingBroadcasts', () => {
    beforeEach(async () => {
      await broadcaster.initialize('event-123');
    });

    it('should clear pending broadcasts', async () => {
      await broadcaster.broadcastEventStatusChange('offline', 'standby', 'system');
      
      broadcaster.clearPendingBroadcasts();
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockBroadcastEvent).not.toHaveBeenCalled();
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getStateBroadcaster();
      const instance2 = getStateBroadcaster();
      expect(instance1).toBe(instance2);
    });
  });
});
