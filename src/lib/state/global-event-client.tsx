import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

/**
 * Client-side Global Event State Management
 * 
 * This module provides a client-side state management system for the party playlist
 * application. It manages the global event state (offline/standby/live) and provides
 * hooks for components to access and update the state.
 */

// Event State Machine Types
export type EventState = 'offline' | 'standby' | 'live';

export interface GlobalEventState {
  // Core state
  status: EventState;
  version: number;
  eventId: string | null;
  activeAdminId: string | null;
  adminName: string | null;
  
  // Page control
  pagesEnabled: {
    requests: boolean;
    display: boolean;
  };
  
  // Event configuration
  config: {
    pages_enabled: {
      requests: boolean;
      display: boolean;
    };
    event_title: string;
    dj_name: string;
    max_requests: number;
    request_limit: number;
    auto_approve: boolean;
  };
  
  // Connection state
  isConnected: boolean;
  lastUpdated: Date | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
}

// Action Types
export type GlobalEventAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_UPDATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTION'; payload: boolean }
  | { type: 'SET_EVENT_STATE'; payload: Partial<GlobalEventState> }
  | { type: 'UPDATE_EVENT'; payload: { status: EventState; version: number; config: any; adminId?: string; adminName?: string } }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: GlobalEventState = {
  status: 'offline',
  version: 0,
  eventId: null,
  activeAdminId: null,
  adminName: null,
  pagesEnabled: {
    requests: false,
    display: false,
  },
  config: {
    pages_enabled: {
      requests: false,
      display: false,
    },
    event_title: 'Party DJ Requests',
    dj_name: '',
    max_requests: 100,
    request_limit: 10,
    auto_approve: false,
  },
  isConnected: false,
  lastUpdated: null,
  isLoading: false,
  isUpdating: false,
  error: null,
};

// State machine logic
export class EventStateMachine {
  static canTransition(from: EventState, to: EventState): boolean {
    const validTransitions: Record<EventState, EventState[]> = {
      offline: ['standby', 'live'],
      standby: ['offline', 'live'],
      live: ['offline', 'standby'],
    };
    
    return validTransitions[from].includes(to);
  }

  static getPageState(eventState: EventState, pagesEnabled: { requests: boolean; display: boolean }) {
    switch (eventState) {
      case 'offline':
        return {
          requests: 'party-not-started',
          display: 'party-not-started',
        };
      case 'standby':
        return {
          requests: 'disabled',
          display: 'disabled',
        };
      case 'live':
        return {
          requests: pagesEnabled.requests ? 'enabled' : 'disabled',
          display: pagesEnabled.display ? 'enabled' : 'disabled',
        };
      default:
        return {
          requests: 'party-not-started',
          display: 'party-not-started',
        };
    }
  }
}

// Reducer function
function globalEventReducer(state: GlobalEventState, action: GlobalEventAction): GlobalEventState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_UPDATING':
      return { ...state, isUpdating: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'SET_CONNECTION':
      return { ...state, isConnected: action.payload };
      
    case 'SET_EVENT_STATE':
      return { ...state, ...action.payload };
      
    case 'UPDATE_EVENT':
      const { status, version, config, adminId, adminName } = action.payload;
      
      return {
        ...state,
        status,
        version,
        config,
        pagesEnabled: config.pages_enabled,
        activeAdminId: adminId || null,
        adminName: adminName || null,
        lastUpdated: new Date(),
        error: null,
      };
      
    case 'RESET_STATE':
      return initialState;
      
    default:
      return state;
  }
}

// Context
const GlobalEventContext = createContext<{
  state: GlobalEventState;
  dispatch: React.Dispatch<GlobalEventAction>;
  actions: GlobalEventActions;
} | null>(null);

// Actions interface
export interface GlobalEventActions {
  // State management
  setLoading: (loading: boolean) => void;
  setUpdating: (updating: boolean) => void;
  setError: (error: string | null) => void;
  setConnection: (connected: boolean) => void;
  
  // Event management
  updateEventStatus: (status: EventState) => Promise<void>;
  updateEventConfig: (config: Partial<any>) => Promise<void>;
  enablePages: (pages: { requests?: boolean; display?: boolean }) => Promise<void>;
  disablePages: () => Promise<void>;
  
  // Utility
  resetState: () => void;
  refreshState: () => Promise<void>;
}

// Actions implementation
function createActions(dispatch: React.Dispatch<GlobalEventAction>): GlobalEventActions {
  return {
    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    
    setUpdating: (updating: boolean) => {
      dispatch({ type: 'SET_UPDATING', payload: updating });
    },
    
    setError: (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },
    
    setConnection: (connected: boolean) => {
      dispatch({ type: 'SET_CONNECTION', payload: connected });
    },
    
    updateEventStatus: async (status: EventState) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // This would typically make an API call to update the server
        // For now, we'll just update the local state
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status,
            version: Date.now(), // Simple version increment
            config: initialState.config,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update event status' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    updateEventConfig: async (config: Partial<any>) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // This would typically make an API call to update the server
        // For now, we'll just update the local state
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: initialState.status,
            version: Date.now(),
            config: { ...initialState.config, ...config },
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update event config' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    enablePages: async (pages: { requests?: boolean; display?: boolean }) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // This would typically make an API call to update the server
        // For now, we'll just update the local state
        const newConfig = {
          ...initialState.config,
          pages_enabled: {
            ...initialState.config.pages_enabled,
            ...pages,
          },
        };
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: initialState.status,
            version: Date.now(),
            config: newConfig,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to enable pages' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    disablePages: async () => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // This would typically make an API call to update the server
        // For now, we'll just update the local state
        const newConfig = {
          ...initialState.config,
          pages_enabled: {
            requests: false,
            display: false,
          },
        };
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: initialState.status,
            version: Date.now(),
            config: newConfig,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to disable pages' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
    },
    
    refreshState: async () => {
      // This would typically make an API call to refresh the state
      // For now, we'll just reset to initial state
      dispatch({ type: 'RESET_STATE' });
    },
  };
}

// Provider component
export function GlobalEventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(globalEventReducer, initialState);
  const actions = createActions(dispatch);
  
  return (
    <GlobalEventContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </GlobalEventContext.Provider>
  );
}

// Hook to use global event state
export function useGlobalEvent() {
  const context = useContext(GlobalEventContext);
  if (!context) {
    throw new Error('useGlobalEvent must be used within a GlobalEventProvider');
  }
  return context;
}

// Convenience hooks
export function usePageState() {
  const { state } = useGlobalEvent();
  return EventStateMachine.getPageState(state.status, state.pagesEnabled);
}

export function useEventConfig() {
  const { state } = useGlobalEvent();
  return state.config;
}

export function useIsLoading() {
  const { state } = useGlobalEvent();
  return state.isLoading;
}

export function useError() {
  const { state } = useGlobalEvent();
  return state.error;
}

// Export actions for server-side use
export function getGlobalEventActions() {
  return {
    updateEventStatus: async (status: EventState) => {
      // This would be implemented on the server side
      console.log('Server-side updateEventStatus called with:', status);
    },
    updateEventConfig: async (config: Partial<any>) => {
      // This would be implemented on the server side
      console.log('Server-side updateEventConfig called with:', config);
    },
    enablePages: async (pages: { requests?: boolean; display?: boolean }) => {
      // This would be implemented on the server side
      console.log('Server-side enablePages called with:', pages);
    },
    disablePages: async () => {
      // This would be implemented on the server side
      console.log('Server-side disablePages called');
    },
  };
}
