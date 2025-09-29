import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { GlobalEventProvider, useGlobalEvent, EventStateMachine, type GlobalEventState, type EventState } from './global-event.tsx';
import { useOptimisticUpdates, OptimisticUpdateManager, type OptimisticUpdate } from './optimistic-updates';
import { useStateRecovery, StateRecoveryManager, type RecoveryConfig } from './state-recovery';
import { useStatePersistence, StatePersistenceManager, type PersistenceConfig } from './state-persistence';
import { stateValidator, stateErrorHandler, type ValidationResult } from './state-validation';

// Mock database
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
}));

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

describe('EventStateMachine', () => {
  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      expect(EventStateMachine.canTransition('offline', 'standby')).toBe(true);
      expect(EventStateMachine.canTransition('offline', 'live')).toBe(true);
      expect(EventStateMachine.canTransition('standby', 'offline')).toBe(true);
      expect(EventStateMachine.canTransition('standby', 'live')).toBe(true);
      expect(EventStateMachine.canTransition('live', 'offline')).toBe(true);
      expect(EventStateMachine.canTransition('live', 'standby')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(EventStateMachine.canTransition('offline', 'offline')).toBe(false);
      expect(EventStateMachine.canTransition('standby', 'standby')).toBe(false);
      expect(EventStateMachine.canTransition('live', 'live')).toBe(false);
    });
  });

  describe('getPageState', () => {
    it('should return party-not-started for offline status', () => {
      const pageState = EventStateMachine.getPageState('offline', { requests: true, display: true });
      expect(pageState.requests).toBe('party-not-started');
      expect(pageState.display).toBe('party-not-started');
    });

    it('should return disabled for standby status', () => {
      const pageState = EventStateMachine.getPageState('standby', { requests: true, display: true });
      expect(pageState.requests).toBe('disabled');
      expect(pageState.display).toBe('disabled');
    });

    it('should return enabled/disabled based on pagesEnabled for live status', () => {
      const pageState1 = EventStateMachine.getPageState('live', { requests: true, display: true });
      expect(pageState1.requests).toBe('enabled');
      expect(pageState1.display).toBe('enabled');

      const pageState2 = EventStateMachine.getPageState('live', { requests: true, display: false });
      expect(pageState2.requests).toBe('enabled');
      expect(pageState2.display).toBe('disabled');

      const pageState3 = EventStateMachine.getPageState('live', { requests: false, display: true });
      expect(pageState3.requests).toBe('disabled');
      expect(pageState3.display).toBe('enabled');
    });
  });

  describe('validateStateTransition', () => {
    const mockState: GlobalEventState = {
      status: 'offline',
      version: 0,
      eventId: 'test-event',
      activeAdminId: null,
      adminName: null,
      pagesEnabled: { requests: false, display: false },
      config: {
        pages_enabled: { requests: false, display: false },
        event_title: 'Test Event',
      },
      isConnected: false,
      lastUpdated: null,
      isLoading: false,
      isUpdating: false,
      error: null,
    };

    it('should validate valid transitions', () => {
      const result = EventStateMachine.validateStateTransition(mockState, 'live', {
        ...mockState.config,
        pages_enabled: { requests: true, display: true },
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid transitions', () => {
      const result = EventStateMachine.validateStateTransition(mockState, 'offline', mockState.config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No changes detected');
    });

    it('should reject live status without enabled pages', () => {
      const result = EventStateMachine.validateStateTransition(mockState, 'live', mockState.config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Live status requires at least one page to be enabled');
    });
  });
});

describe('OptimisticUpdateManager', () => {
  let updateManager: OptimisticUpdateManager;

  beforeEach(() => {
    updateManager = new OptimisticUpdateManager();
  });

  describe('createUpdate', () => {
    it('should create a new optimistic update', () => {
      const update = updateManager.createUpdate('status', { status: 'live' });
      
      expect(update.id).toBeDefined();
      expect(update.type).toBe('status');
      expect(update.payload).toEqual({ status: 'live' });
      expect(update.status).toBe('pending');
      expect(update.version).toBe(1);
    });

    it('should increment version for each update', () => {
      const update1 = updateManager.createUpdate('status', { status: 'live' });
      const update2 = updateManager.createUpdate('config', { event_title: 'New Event' });
      
      expect(update1.version).toBe(1);
      expect(update2.version).toBe(2);
    });
  });

  describe('applyOptimisticUpdate', () => {
    it('should apply status update to state', () => {
      const currentState: GlobalEventState = {
        status: 'offline',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      const update = updateManager.createUpdate('status', { status: 'live' });
      const newState = updateManager.applyOptimisticUpdate(currentState, update);

      expect(newState.status).toBe('live');
      expect(newState.version).toBe(1);
    });

    it('should apply config update to state', () => {
      const currentState: GlobalEventState = {
        status: 'offline',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      const update = updateManager.createUpdate('config', { event_title: 'New Event' });
      const newState = updateManager.applyOptimisticUpdate(currentState, update);

      expect(newState.config.event_title).toBe('New Event');
      expect(newState.version).toBe(1);
    });
  });

  describe('getPendingUpdates', () => {
    it('should return pending updates', () => {
      updateManager.createUpdate('status', { status: 'live' });
      updateManager.createUpdate('config', { event_title: 'New Event' });
      
      const pendingUpdates = updateManager.getPendingUpdates();
      expect(pendingUpdates).toHaveLength(2);
    });
  });
});

describe('useOptimisticUpdates', () => {
  it('should provide optimistic update functionality', () => {
    const { result } = renderHook(() => useOptimisticUpdates());

    expect(result.current.createUpdate).toBeDefined();
    expect(result.current.applyUpdate).toBeDefined();
    expect(result.current.retryUpdate).toBeDefined();
    expect(result.current.removeUpdate).toBeDefined();
    expect(result.current.getPendingUpdates).toBeDefined();
    expect(result.current.getFailedUpdates).toBeDefined();
  });

  it('should create and track updates', () => {
    const { result } = renderHook(() => useOptimisticUpdates());

    act(() => {
      const update = result.current.createUpdate('status', { status: 'live' });
      expect(update.type).toBe('status');
      expect(update.payload).toEqual({ status: 'live' });
    });

    expect(result.current.updates).toHaveLength(1);
  });
});

describe('StateRecoveryManager', () => {
  let recoveryManager: StateRecoveryManager;

  beforeEach(() => {
    recoveryManager = new StateRecoveryManager({
      maxRetries: 3,
      retryDelay: 100,
      healthCheckInterval: 1000,
      syncInterval: 1000,
    });
  });

  afterEach(() => {
    recoveryManager.stop();
  });

  describe('performHealthCheck', () => {
    it('should perform health check', async () => {
      const healthCheck = await recoveryManager.performHealthCheck();
      
      expect(healthCheck).toBeDefined();
      expect(healthCheck.database).toBeDefined();
      expect(healthCheck.connection).toBeDefined();
      expect(healthCheck.sync).toBeDefined();
      expect(healthCheck.lastCheck).toBeDefined();
      expect(healthCheck.errors).toBeDefined();
    });
  });

  describe('attemptRecovery', () => {
    it('should attempt recovery', async () => {
      const result = await recoveryManager.attemptRecovery();
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});

describe('useStateRecovery', () => {
  it('should provide recovery functionality', () => {
    const { result } = renderHook(() => useStateRecovery());

    expect(result.current.recoveryState).toBeDefined();
    expect(result.current.performHealthCheck).toBeDefined();
    expect(result.current.attemptRecovery).toBeDefined();
    expect(result.current.performSync).toBeDefined();
    expect(result.current.getUpdateManager).toBeDefined();
  });
});

describe('StatePersistenceManager', () => {
  let persistenceManager: StatePersistenceManager;

  beforeEach(() => {
    persistenceManager = new StatePersistenceManager({
      storageType: 'localStorage',
      maxStorageSize: 1,
    });
  });

  describe('saveState', () => {
    it('should save state to localStorage', async () => {
      const mockState: GlobalEventState = {
        status: 'offline',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      await persistenceManager.saveState(mockState);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'party-playlist-state',
        expect.stringContaining('"status":"offline"')
      );
    });
  });

  describe('loadState', () => {
    it('should load state from localStorage', async () => {
      const mockState = {
        globalEventState: {
          status: 'offline',
          version: 0,
          eventId: 'test-event',
          activeAdminId: null,
          adminName: null,
          pagesEnabled: { requests: false, display: false },
          config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
          isConnected: false,
          lastUpdated: null,
          isLoading: false,
          isUpdating: false,
          error: null,
        },
        optimisticUpdates: [],
        lastSyncTimestamp: Date.now(),
        version: '1.0.0',
        checksum: 'test-checksum',
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockState));

      const loadedState = await persistenceManager.loadState();

      expect(loadedState).toBeDefined();
      expect(loadedState?.globalEventState.status).toBe('offline');
    });
  });
});

describe('useStatePersistence', () => {
  it('should provide persistence functionality', () => {
    const { result } = renderHook(() => useStatePersistence());

    expect(result.current.isInitialized).toBeDefined();
    expect(result.current.saveState).toBeDefined();
    expect(result.current.loadState).toBeDefined();
    expect(result.current.saveOptimisticUpdates).toBeDefined();
    expect(result.current.loadOptimisticUpdates).toBeDefined();
    expect(result.current.getStorageStats).toBeDefined();
    expect(result.current.clearAllData).toBeDefined();
  });
});

describe('StateValidator', () => {
  describe('validateGlobalEventState', () => {
    it('should validate valid state', () => {
      const validState: GlobalEventState = {
        status: 'offline',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      const result = stateValidator.validateGlobalEventState(validState);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid status', () => {
      const invalidState: GlobalEventState = {
        status: 'invalid' as EventState,
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      const result = stateValidator.validateGlobalEventState(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('status');
    });

    it('should detect live status without enabled pages', () => {
      const invalidState: GlobalEventState = {
        status: 'live',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      const result = stateValidator.validateGlobalEventState(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'LIVE_STATUS_REQUIRES_PAGES')).toBe(true);
    });
  });

  describe('validateOptimisticUpdate', () => {
    it('should validate valid update', () => {
      const validUpdate: OptimisticUpdate = {
        id: 'update-1',
        type: 'status',
        payload: { status: 'live' },
        timestamp: Date.now(),
        version: 1,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      };

      const result = stateValidator.validateOptimisticUpdate(validUpdate);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid update type', () => {
      const invalidUpdate: OptimisticUpdate = {
        id: 'update-1',
        type: 'invalid' as any,
        payload: { status: 'live' },
        timestamp: Date.now(),
        version: 1,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      };

      const result = stateValidator.validateOptimisticUpdate(invalidUpdate);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'type')).toBe(true);
    });
  });
});

describe('StateErrorHandler', () => {
  describe('handleValidationErrors', () => {
    it('should handle validation errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result: ValidationResult = {
        isValid: false,
        errors: [{
          field: 'status',
          message: 'Invalid status',
          code: 'INVALID_STATUS',
          severity: 'error',
        }],
        warnings: [],
      };

      stateErrorHandler.handleValidationErrors(result);
      
      expect(consoleSpy).toHaveBeenCalledWith('State validation failed:', result.errors);
      consoleSpy.mockRestore();
    });
  });

  describe('validateAndHandle', () => {
    it('should validate and handle state', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const validState: GlobalEventState = {
        status: 'offline',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      const result = stateErrorHandler.validateAndHandle(validState);
      expect(result.isValid).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Integration Tests', () => {
  describe('Global Event Provider with Optimistic Updates', () => {
    it('should work with optimistic updates', () => {
      const TestComponent = () => {
        const { state, actions } = useGlobalEvent();
        const { createUpdate } = useOptimisticUpdates();
        
        return (
          <div>
            <span data-testid="status">{state.status}</span>
            <button
              onClick={() => {
                const update = createUpdate('status', { status: 'live' });
                // Apply optimistic update
              }}
            >
              Update Status
            </button>
          </div>
        );
      };

      const { container } = renderHook(() => (
        <GlobalEventProvider>
          <TestComponent />
        </GlobalEventProvider>
      ));

      expect(container).toBeDefined();
    });
  });

  describe('State Recovery with Persistence', () => {
    it('should recover state from persistence', async () => {
      const { result: persistenceResult } = renderHook(() => useStatePersistence());
      const { result: recoveryResult } = renderHook(() => useStateRecovery());

      // Mock persisted state
      const mockState: GlobalEventState = {
        status: 'offline',
        version: 0,
        eventId: 'test-event',
        activeAdminId: null,
        adminName: null,
        pagesEnabled: { requests: false, display: false },
        config: { pages_enabled: { requests: false, display: false }, event_title: 'Test' },
        isConnected: false,
        lastUpdated: null,
        isLoading: false,
        isUpdating: false,
        error: null,
      };

      // Save state
      await persistenceResult.current.saveState(mockState);

      // Load state
      const loadedState = await persistenceResult.current.loadState();
      expect(loadedState).toBeDefined();
    });
  });
});
