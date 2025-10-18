import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { db } from '@/lib/db';
import { events, type Event, type EventStatus, type EventConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Global Event State Management
 * 
 * This module provides a centralized state management system for the party playlist
 * application. It manages the global event state (offline/standby/live) and ensures
 * all devices stay synchronized through Pusher real-time updates.
 */

// Event State Machine Types
export type EventState = 'offline' | 'standby' | 'live';

export interface GlobalEventState {
  // Core state
  status: EventState;
  version: number;
  eventId: string | null;
  
  // Admin information
  activeAdminId: string | null;
  adminName: string | null;
  
  // Page control
  pagesEnabled: {
    requests: boolean;
    display: boolean;
  };
  
  // Event configuration
  config: EventConfig;
  
  // Connection status
  isConnected: boolean;
  lastUpdated: Date | null;
  
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  
  // Error handling
  error: string | null;
}

// Action Types
export type GlobalEventAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_UPDATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTION'; payload: boolean }
  | { type: 'SET_EVENT_STATE'; payload: Partial<GlobalEventState> }
  | { type: 'UPDATE_EVENT'; payload: { status: EventState; version: number; config: EventConfig; adminId?: string; adminName?: string } }
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
    venue_info: '',
    welcome_message: 'Request your favorite songs!',
    secondary_message: 'Your requests will be reviewed by the DJ',
    tertiary_message: 'Keep the party going!',
    show_qr_code: true,
    request_limit: 10,
    auto_approve: false,
  },
  isConnected: false,
  lastUpdated: null,
  isLoading: true,
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

  static validateStateTransition(
    currentState: GlobalEventState,
    newStatus: EventState,
    newConfig: EventConfig
  ): { valid: boolean; reason?: string } {
    // Check if transition is valid
    if (!this.canTransition(currentState.status, newStatus)) {
      return {
        valid: false,
        reason: `Invalid transition from ${currentState.status} to ${newStatus}`,
      };
    }

    // Validate config based on status
    if (newStatus === 'live' && (!newConfig.pages_enabled.requests && !newConfig.pages_enabled.display)) {
      return {
        valid: false,
        reason: 'Live status requires at least one page to be enabled',
      };
    }

    // Validate version increment
    if (newStatus === currentState.status && newConfig === currentState.config) {
      return {
        valid: false,
        reason: 'No changes detected',
      };
    }

    return { valid: true };
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
      
      // Validate state transition
      const validation = EventStateMachine.validateStateTransition(state, status, config);
      if (!validation.valid) {
        return { ...state, error: validation.reason || 'Invalid state transition' };
      }
      
      return {
        ...state,
        status,
        version,
        config,
        activeAdminId: adminId || state.activeAdminId,
        adminName: adminName || state.adminName,
        pagesEnabled: config.pages_enabled,
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
  
  // Event operations
  loadEvent: () => Promise<void>;
  updateEventStatus: (status: EventState) => Promise<void>;
  updateEventConfig: (config: Partial<EventConfig>) => Promise<void>;
  enablePages: (pages: { requests?: boolean; display?: boolean }) => Promise<void>;
  disablePages: () => Promise<void>;
  
  // Admin operations
  setActiveAdmin: (adminId: string, adminName: string) => Promise<void>;
  clearActiveAdmin: () => Promise<void>;
  
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
    
    loadEvent: async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Load event from database
        const eventResults = await db.select().from(events).limit(1);
        
        if (eventResults.length === 0) {
          // No event exists, create default
          const [newEvent] = await db.insert(events).values({
            status: 'offline',
            version: 0,
            config: initialState.config,
          } as any).returning();
          
          dispatch({
            type: 'UPDATE_EVENT',
            payload: {
              status: 'offline',
              version: 0,
              config: initialState.config,
            },
          });
          
          dispatch({ type: 'SET_EVENT_STATE', payload: { eventId: newEvent.id } });
        } else {
          const event = eventResults[0];
          
          dispatch({
            type: 'UPDATE_EVENT',
            payload: {
              status: event.status as EventState,
              version: event.version,
              config: event.config as EventConfig,
              adminId: event.active_admin_id || undefined,
            },
          });
          
          dispatch({ type: 'SET_EVENT_STATE', payload: { eventId: event.id } });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load event' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    updateEventStatus: async (status: EventState) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current state
        const currentEventResults = await db.select().from(events).limit(1);
        if (currentEventResults.length === 0) {
          throw new Error('No event found');
        }
        
        const currentEvent = currentEventResults[0];
        const newConfig = currentEvent.config as EventConfig;
        
        // Validate transition
        const validation = EventStateMachine.validateStateTransition(
          {
            status: currentEvent.status as EventState,
            version: currentEvent.version,
            config: newConfig,
            pagesEnabled: newConfig.pages_enabled,
          } as GlobalEventState,
          status,
          newConfig
        );
        
        if (!validation.valid) {
          throw new Error(validation.reason || 'Invalid state transition');
        }
        
        // Update database
        const [updatedEvent] = await db
          .update(events)
          .set({
            status,
            version: currentEvent.version + 1,
            updated_at: new Date(),
          })
          .where(eq(events.id, currentEvent.id))
          .returning();
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: updatedEvent.status as EventState,
            version: updatedEvent.version,
            config: updatedEvent.config as EventConfig,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update event status' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    updateEventConfig: async (configUpdate: Partial<EventConfig>) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current state
        const currentEventResults = await db.select().from(events).limit(1);
        if (currentEventResults.length === 0) {
          throw new Error('No event found');
        }
        
        const currentEvent = currentEventResults[0];
        const currentConfig = currentEvent.config as EventConfig;
        const newConfig = { ...currentConfig, ...configUpdate };
        
        // Update database
        const [updatedEvent] = await db
          .update(events)
          .set({
            config: newConfig,
            version: currentEvent.version + 1,
            updated_at: new Date(),
          })
          .where(eq(events.id, currentEvent.id))
          .returning();
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: updatedEvent.status as EventState,
            version: updatedEvent.version,
            config: updatedEvent.config as EventConfig,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update event config' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    enablePages: async (pages: { requests?: boolean; display?: boolean }) => {
      const currentEventResults = await db.select().from(events).limit(1);
      if (currentEventResults.length === 0) {
        throw new Error('No event found');
      }
      
      const currentEvent = currentEventResults[0];
      const currentConfig = currentEvent.config as EventConfig;
      
      const newConfig = {
        ...currentConfig,
        pages_enabled: {
          ...currentConfig.pages_enabled,
          ...pages,
        },
      };
      
      await createActions(dispatch).updateEventConfig(newConfig);
    },
    
    disablePages: async () => {
      await createActions(dispatch).updateEventConfig({
        pages_enabled: {
          requests: false,
          display: false,
        },
      });
    },
    
    setActiveAdmin: async (adminId: string, adminName: string) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current event
        const currentEventResults = await db.select().from(events).limit(1);
        if (currentEventResults.length === 0) {
          throw new Error('No event found');
        }
        
        const currentEvent = currentEventResults[0];
        
        // Update database
        await db
          .update(events)
          .set({
            active_admin_id: adminId,
            version: currentEvent.version + 1,
            updated_at: new Date(),
          })
          .where(eq(events.id, currentEvent.id));
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: currentEvent.status as EventState,
            version: currentEvent.version + 1,
            config: currentEvent.config as EventConfig,
            adminId,
            adminName,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to set active admin' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    clearActiveAdmin: async () => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current event
        const currentEventResults = await db.select().from(events).limit(1);
        if (currentEventResults.length === 0) {
          throw new Error('No event found');
        }
        
        const currentEvent = currentEventResults[0];
        
        // Update database
        await db
          .update(events)
          .set({
            active_admin_id: null,
            version: currentEvent.version + 1,
            updated_at: new Date(),
          })
          .where(eq(events.id, currentEvent.id));
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: currentEvent.status as EventState,
            version: currentEvent.version + 1,
            config: currentEvent.config as EventConfig,
            adminId: undefined,
            adminName: undefined,
          },
        });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to clear active admin' });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
    },
    
    refreshState: async () => {
      await createActions(dispatch).loadEvent();
    },
  };
}

// Provider component
export function GlobalEventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(globalEventReducer, initialState);
  const actions = createActions(dispatch);
  
  // Load event on mount
  useEffect(() => {
    actions.loadEvent();
  }, []);
  
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

// Utility hooks for specific state
export function useEventStatus() {
  const { state } = useGlobalEvent();
  return state.status;
}

export function usePagesEnabled() {
  const { state } = useGlobalEvent();
  return state.pagesEnabled;
}

export function useEventConfig() {
  const { state } = useGlobalEvent();
  return state.config;
}

export function useIsConnected() {
  const { state } = useGlobalEvent();
  return state.isConnected;
}

export function useIsLoading() {
  const { state } = useGlobalEvent();
  return state.isLoading;
}

export function useIsUpdating() {
  const { state } = useGlobalEvent();
  return state.isUpdating;
}

export function useError() {
  const { state } = useGlobalEvent();
  return state.error;
}

// Page state hook
export function usePageState() {
  const { state } = useGlobalEvent();
  return EventStateMachine.getPageState(state.status, state.pagesEnabled);
}

// Export types
// re-export types not needed; they are already declared above
