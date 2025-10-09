'use client';

import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useOptionalAdminAuth } from '@/contexts/AdminAuthContext';

/**
 * Client-side Global Event State Management
 * 
 * This module provides a client-side state management system for the party playlist
 * application. It manages the global event state (offline/standby/live) and provides
 * hooks for components to access and update the state.
 * 
 * AUTHENTICATION:
 * - Public pages (home, display) use this WITHOUT admin auth - read-only GET requests
 * - Admin pages use this WITH admin auth - authenticated POST/PUT requests
 * - Auth token is provided via AdminAuthContext (optional)
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
  pin: string | null;
  bypassToken: string | null;
  
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
  | { type: 'UPDATE_EVENT'; payload: { status: EventState; version: number; config: any; adminId?: string; adminName?: string; pin?: string; bypassToken?: string } }
  | { type: 'RESET_STATE' };

// Get or create default event ID
// For multi-event support in the future, this could be retrieved from URL params
// For now, we'll use null and let the server determine the current active event
const getDefaultEventId = (): string | null => {
  return null;
};

// Initial state
const initialState: GlobalEventState = {
  status: 'offline',
  version: 0,
  eventId: getDefaultEventId(),
  activeAdminId: null,
  adminName: null,
  pin: null,
  bypassToken: null,
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
      const { status, version, config, adminId, adminName, pin, bypassToken } = action.payload;
      
      console.log('🔄 [UPDATE_EVENT] Reducer called with:', {
        status,
        version,
        config,
        pages_enabled: config?.pages_enabled,
        extractedPagesEnabled: config?.pages_enabled,
        pin,
        bypassToken
      });
      
      const newState = {
        ...state,
        status,
        version,
        config,
        pagesEnabled: config?.pages_enabled || state.pagesEnabled,
        activeAdminId: adminId || null,
        adminName: adminName || null,
        pin: pin || state.pin,
        bypassToken: bypassToken || state.bypassToken,
        lastUpdated: new Date(),
        error: null,
      };
      
      console.log('✅ [UPDATE_EVENT] New state:', {
        status: newState.status,
        pagesEnabled: newState.pagesEnabled,
        pin: newState.pin,
        bypassToken: newState.bypassToken
      });
      
      return newState;
      
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
  setEventStatus: (status: EventState) => Promise<void>; // Alias for updateEventStatus
  updateEventConfig: (config: Partial<any>) => Promise<void>;
  enablePages: (pages: { requests?: boolean; display?: boolean }) => Promise<void>;
  disablePages: () => Promise<void>;
  setPageEnabled: (page: 'requests' | 'display', enabled: boolean) => Promise<void>;
  
  // Utility
  resetState: () => void;
  refreshState: () => Promise<void>;
}

// Actions implementation
function createActions(
  dispatch: React.Dispatch<GlobalEventAction>, 
  getState: () => GlobalEventState,
  getToken: () => string | null
): GlobalEventActions {
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
        
        // Get current event ID
        const eventId = getState().eventId || getDefaultEventId();
        
        // Get auth token (if available - only for admin pages)
        const token = getToken();
        
        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Add Authorization header if token is available (admin context)
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Make API call to update the server
        const response = await fetch('/api/event/status', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            status,
            eventId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update event status');
        }

        const result = await response.json();
        
        // Update local state with server response
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: result.event.status,
            version: result.event.version,
            config: result.event.config,
            adminId: result.event.activeAdminId,
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
    
    setPageEnabled: async (page: 'requests' | 'display', enabled: boolean) => {
      try {
        console.log('🔄 [setPageEnabled] START:', { page, enabled });
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const eventId = getState().eventId || getDefaultEventId();
        console.log('🔄 [setPageEnabled] eventId:', eventId);
        
        // Get auth token (if available - only for admin pages)
        const token = getToken();
        console.log('🔄 [setPageEnabled] token present:', !!token);
        
        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Add Authorization header if token is available (admin context)
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const requestBody = { page, enabled, eventId };
        console.log('🔄 [setPageEnabled] Making API request to /api/event/pages:', requestBody);
        
        const response = await fetch('/api/event/pages', {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        console.log('🔄 [setPageEnabled] API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ [setPageEnabled] API error:', errorData);
          throw new Error(errorData.error || 'Failed to update page control');
        }

        const result = await response.json();
        console.log('✅ [setPageEnabled] API response data:', result);
        
        const updatePayload = {
          status: result.event.status,
          version: result.event.version,
          config: result.event.config,
        };
        console.log('🔄 [setPageEnabled] Dispatching UPDATE_EVENT:', updatePayload);
        
        dispatch({
          type: 'UPDATE_EVENT',
          payload: updatePayload,
        });
        
        console.log('✅ [setPageEnabled] COMPLETE - state updated');
      } catch (error) {
        console.error('❌ [setPageEnabled] ERROR:', error);
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : `Failed to ${enabled ? 'enable' : 'disable'} ${page} page` });
      } finally {
        dispatch({ type: 'SET_UPDATING', payload: false });
      }
    },
    
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
    },
    
    refreshState: async () => {
      try {
        console.log('🔄 refreshState called');
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current event ID
        const eventId = getState().eventId || getDefaultEventId();
        console.log('📡 Fetching event status for eventId:', eventId);
        
        // Check if we're on a public page (/:username/request or /:username/display)
        const isPublicPage = typeof window !== 'undefined' && 
          (window.location.pathname.includes('/request') || window.location.pathname.includes('/display'));
        
        let response;
        
        if (isPublicPage) {
          // Extract username from URL path (/:username/request or /:username/display)
          const pathParts = window.location.pathname.split('/');
          const username = pathParts[1]; // Username is the first path segment
          
          if (username && username !== 'api' && username !== 'login' && username !== 'register') {
            console.log(`🌐 Public page detected, fetching status for username: ${username}`);
            response = await fetch(`/api/events/public-status?username=${encodeURIComponent(username)}`);
          } else {
            // Fallback to authenticated endpoint
            response = await fetch('/api/event/status');
          }
        } else {
          // Admin/authenticated pages use the authenticated endpoint
          response = await fetch('/api/event/status');
        }
        
        console.log('📡 API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ API error:', errorData);
          throw new Error(errorData.error || 'Failed to load event state');
        }

        const result = await response.json();
        console.log('✅ API response data:', result);
        console.log('✅ Config from API:', result.event.config);
        console.log('✅ pages_enabled from config:', result.event.config?.pages_enabled);
        
        // Update local state with server response
        dispatch({
          type: 'UPDATE_EVENT',
          payload: {
            status: result.event.status,
            version: result.event.version,
            config: result.event.config,
            adminId: result.event.activeAdminId,
            pin: result.event.pin,
            bypassToken: result.event.bypassToken,
          },
        });
        console.log('✅ State updated successfully');
      } catch (error) {
        console.error('❌ refreshState error:', error);
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to refresh state' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
  };
}

// Provider component
export function GlobalEventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(globalEventReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  
  // Try to get admin auth context (will be null on public pages, which is fine)
  const adminAuth = useOptionalAdminAuth();
  
  const actions = useMemo(() => {
    const getToken = () => adminAuth?.token || null;
    const actions = createActions(dispatch, () => stateRef.current, getToken);
    // Add alias for backward compatibility
    actions.setEventStatus = actions.updateEventStatus;
    return actions;
  }, [dispatch, adminAuth?.token]);

  // Load initial state on mount
  useEffect(() => {
    console.log('🚀 GlobalEventProvider mounted, calling refreshState');
    actions.refreshState();
  }, []); // Only run once on mount

  // Listen for Pusher events (state updates and page control changes)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let pusherInstance: any = null;
    let channelInstance: any = null;

    // Fetch userId and subscribe to user-specific channel
    const setupPusher = async () => {
      try {
        let userId: string | null = null;

        // First, try to get authenticated user's ID
        const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
        if (authResponse.ok) {
          const authData = await authResponse.json();
          userId = authData.user?.id; // ✅ Fixed: API returns 'id', not 'user_id'
        }

        // If not authenticated, check if we're on a public page
        if (!userId) {
          const isPublicPage = window.location.pathname.includes('/request') || window.location.pathname.includes('/display');
          if (isPublicPage) {
            // Extract username from URL path (/:username/request or /:username/display)
            const pathParts = window.location.pathname.split('/');
            const username = pathParts[1];
            
            if (username && username !== 'api' && username !== 'login' && username !== 'register') {
              console.log(`🌐 Public page detected, looking up userId for username: ${username}`);
              // Look up userId from username via API
              const userLookupResponse = await fetch(`/api/users/lookup?username=${encodeURIComponent(username)}`);
              if (userLookupResponse.ok) {
                const lookupData = await userLookupResponse.json();
                userId = lookupData.userId;
              }
            }
          }
        }

        if (!userId) {
          console.warn('⚠️ No userId found, skipping Pusher setup');
          return;
        }

        console.log(`📡 Setting up Pusher for user ${userId}`);

        // Import Pusher client-side only
        const { default: Pusher } = await import('pusher-js');
        pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || '', {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu',
          authEndpoint: '/api/pusher/auth',
        });

        // Subscribe to USER-SPECIFIC channel
        const userChannel = `private-party-playlist-${userId}`;
        console.log(`📡 Subscribing to user-specific channel: ${userChannel}`);
        channelInstance = pusherInstance.subscribe(userChannel);

        // Listen for state updates (use hyphens - Pusher uses hyphens not underscores)
        channelInstance.bind('state-update', (data: any) => {
          console.log('📡 [GlobalEventProvider] Received state-update via Pusher:', data);
          dispatch({
            type: 'UPDATE_EVENT',
            payload: {
              status: data.status,
              version: data.version || Date.now(),
              config: {
                ...stateRef.current.config,
                ...data.config,
                // Preserve pagesEnabled if not provided
                pages_enabled: data.pagesEnabled || data.config?.pages_enabled || stateRef.current.pagesEnabled,
              },
            },
          });
        });

        // Listen for page control updates (use hyphens - Pusher uses hyphens not underscores)
        channelInstance.bind('page-control-toggle', (data: any) => {
          console.log('📡 [GlobalEventProvider] Received page-control-toggle via Pusher:', data);
          console.log('📡 [GlobalEventProvider] Current state before update:', {
            status: stateRef.current.status,
            pagesEnabled: stateRef.current.pagesEnabled,
          });
          
          const newPagesEnabled = data.pagesEnabled || {
            requests: data.requests_page_enabled ?? stateRef.current.pagesEnabled.requests,
            display: data.display_page_enabled ?? stateRef.current.pagesEnabled.display,
          };
          
          console.log('📡 [GlobalEventProvider] New pagesEnabled:', newPagesEnabled);
          
          dispatch({
            type: 'UPDATE_EVENT',
            payload: {
              status: stateRef.current.status,
              version: Date.now(),
              config: {
                ...stateRef.current.config,
                pages_enabled: newPagesEnabled,
              },
            },
          });
          
          console.log('✅ [GlobalEventProvider] page-control-toggle state updated');
        });

      } catch (error) {
        console.error('❌ Failed to setup Pusher:', error);
      }
    };

    // Start Pusher setup
    setupPusher();

    // Cleanup function
    return () => {
      if (channelInstance) {
        channelInstance.unbind_all();
        channelInstance.unsubscribe();
      }
      if (pusherInstance) {
        pusherInstance.disconnect();
      }
    };
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
