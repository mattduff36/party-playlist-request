import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { GlobalEventProvider, useGlobalEvent, EventStateMachine, type GlobalEventState, type EventState } from './global-event';

// Mock database
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock React context
const mockContext = {
  state: {
    status: 'offline' as EventState,
    version: 0,
    eventId: null,
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
  },
  dispatch: vi.fn(),
  actions: {
    setLoading: vi.fn(),
    setUpdating: vi.fn(),
    setError: vi.fn(),
    setConnection: vi.fn(),
    loadEvent: vi.fn(),
    updateEventStatus: vi.fn(),
    updateEventConfig: vi.fn(),
    enablePages: vi.fn(),
    disablePages: vi.fn(),
    setActiveAdmin: vi.fn(),
    clearActiveAdmin: vi.fn(),
    resetState: vi.fn(),
    refreshState: vi.fn(),
  },
};

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

describe('GlobalEventProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide context to children', () => {
    const TestComponent = () => {
      const { state } = useGlobalEvent();
      return <div>{state.status}</div>;
    };

    const { container } = renderHook(() => (
      <GlobalEventProvider>
        <TestComponent />
      </GlobalEventProvider>
    ));

    expect(container).toBeDefined();
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useGlobalEvent());
    }).toThrow('useGlobalEvent must be used within a GlobalEventProvider');
  });
});

describe('useGlobalEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return context values', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current.state).toBeDefined();
    expect(result.current.dispatch).toBeDefined();
    expect(result.current.actions).toBeDefined();
  });
});

describe('Utility Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return event status', () => {
    const { result } = renderHook(() => useEventStatus(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toBe('offline');
  });

  it('should return pages enabled state', () => {
    const { result } = renderHook(() => usePagesEnabled(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toEqual({ requests: false, display: false });
  });

  it('should return event config', () => {
    const { result } = renderHook(() => useEventConfig(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toBeDefined();
    expect(result.current.event_title).toBe('Test Event');
  });

  it('should return connection status', () => {
    const { result } = renderHook(() => useIsConnected(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toBe(false);
  });

  it('should return loading status', () => {
    const { result } = renderHook(() => useIsLoading(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toBe(false);
  });

  it('should return updating status', () => {
    const { result } = renderHook(() => useIsUpdating(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toBe(false);
  });

  it('should return error state', () => {
    const { result } = renderHook(() => useError(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toBe(null);
  });

  it('should return page state', () => {
    const { result } = renderHook(() => usePageState(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    expect(result.current).toEqual({
      requests: 'party-not-started',
      display: 'party-not-started',
    });
  });
});

describe('State Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle state transitions correctly', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_EVENT',
        payload: {
          status: 'live',
          version: 1,
          config: {
            pages_enabled: { requests: true, display: true },
            event_title: 'Live Event',
          },
        },
      });
    });

    expect(result.current.state.status).toBe('live');
    expect(result.current.state.version).toBe(1);
    expect(result.current.state.pagesEnabled.requests).toBe(true);
    expect(result.current.state.pagesEnabled.display).toBe(true);
  });

  it('should handle error states', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    act(() => {
      result.current.dispatch({
        type: 'SET_ERROR',
        payload: 'Test error message',
      });
    });

    expect(result.current.state.error).toBe('Test error message');
  });

  it('should handle loading states', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    act(() => {
      result.current.dispatch({
        type: 'SET_LOADING',
        payload: true,
      });
    });

    expect(result.current.state.isLoading).toBe(true);
  });

  it('should handle connection states', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    act(() => {
      result.current.dispatch({
        type: 'SET_CONNECTION',
        payload: true,
      });
    });

    expect(result.current.state.isConnected).toBe(true);
  });

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    // First, set some state
    act(() => {
      result.current.dispatch({
        type: 'UPDATE_EVENT',
        payload: {
          status: 'live',
          version: 1,
          config: {
            pages_enabled: { requests: true, display: true },
            event_title: 'Live Event',
          },
        },
      });
    });

    expect(result.current.state.status).toBe('live');

    // Then reset
    act(() => {
      result.current.dispatch({
        type: 'RESET_STATE',
      });
    });

    expect(result.current.state.status).toBe('offline');
    expect(result.current.state.version).toBe(0);
    expect(result.current.state.pagesEnabled.requests).toBe(false);
    expect(result.current.state.pagesEnabled.display).toBe(false);
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle invalid state transitions', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_EVENT',
        payload: {
          status: 'live',
          version: 1,
          config: {
            pages_enabled: { requests: false, display: false },
            event_title: 'Invalid Event',
          },
        },
      });
    });

    expect(result.current.state.error).toBe('Live status requires at least one page to be enabled');
  });

  it('should clear errors on successful operations', () => {
    const { result } = renderHook(() => useGlobalEvent(), {
      wrapper: ({ children }) => <GlobalEventProvider>{children}</GlobalEventProvider>,
    });

    // Set an error
    act(() => {
      result.current.dispatch({
        type: 'SET_ERROR',
        payload: 'Test error',
      });
    });

    expect(result.current.state.error).toBe('Test error');

    // Clear error with successful operation
    act(() => {
      result.current.dispatch({
        type: 'UPDATE_EVENT',
        payload: {
          status: 'live',
          version: 1,
          config: {
            pages_enabled: { requests: true, display: true },
            event_title: 'Valid Event',
          },
        },
      });
    });

    expect(result.current.state.error).toBe(null);
  });
});
