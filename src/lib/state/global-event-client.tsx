'use client';

import React, { createContext, useContext, useReducer, useEffect, useMemo, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

/**
 * Client-side Global Event State Management
 * 
 * This module provides a client-side state management system for the party playlist
 * application. It manages the global event state (offline/standby/live) and provides
 * hooks for components to access and update the state.
 * 
 * AUTHENTICATION:
 * - Public pages (home, display) use this WITHOUT admin auth - read-only GET requests
 * - Admin pages use cookie + CSRF via authenticatedFetch for mutations (PRD-02)
 */

// Event State Machine Types
export type EventState = 'offline' | 'standby' | 'live';

export interface EventConfig {
  pages_enabled: {
    requests: boolean;
    display: boolean;
  };
  event_title: string;
  dj_name: string;
  max_requests: number;
  request_limit: number;
  auto_approve: boolean;
}

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
  config: EventConfig;
  
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
  | { type: 'UPDATE_EVENT'; payload: { status: EventState; version: number; config: EventConfig; adminId?: string; adminName?: string; pin?: string; bypassToken?: string } }
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
  // Start loading so consumers do not treat default offline as authoritative
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
        // Prefer explicit pages_enabled (including all-false); only fall back if missing
        pagesEnabled: config?.pages_enabled ?? state.pagesEnabled,
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
  updateEventConfig: (config: Partial<EventConfig>) => Promise<void>;
  enablePages: (pages: { requests?: boolean; display?: boolean }) => Promise<void>;
  disablePages: () => Promise<void>;
  setPageEnabled: (page: 'requests' | 'display', enabled: boolean) => Promise<void>;
  
  // Utility
  resetState: () => void;
  refreshState: () => Promise<void>;
  /** Apply page-control-toggle from Pusher (display/request backup path). */
  applyRemotePageControl: (data: {
    pagesEnabled?: { requests?: boolean; display?: boolean };
    page?: 'requests' | 'display';
    enabled?: boolean;
    requests_page_enabled?: boolean;
    display_page_enabled?: boolean;
  }) => void;
}

/** Username from /{username}/… or /{username}/{accessCode}/display|request */
function getPublicPageUsernameFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const reserved = new Set([
    'api',
    'login',
    'register',
    'auth',
    'superadmin',
    'contact',
    'privacy',
    'terms',
  ]);
  const username = parts[0];
  if (!username || reserved.has(username)) return null;
  const isPublicSurface = parts.includes('display') || parts.includes('request');
  return isPublicSurface ? username : null;
}

// Actions implementation
function createActions(
  dispatch: React.Dispatch<GlobalEventAction>, 
  getState: () => GlobalEventState
): GlobalEventActions {
  const actions: GlobalEventActions = {
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

    setEventStatus: async (status: EventState) => {
      await actions.updateEventStatus(status);
    },
    
    updateEventStatus: async (status: EventState) => {
      try {
        dispatch({ type: 'SET_UPDATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current event ID
        const eventId = getState().eventId || getDefaultEventId();
        
        // Bound so Event Control "Updating..." cannot stick if the API stalls
        const response = await authenticatedFetch('/api/event/status', {
          method: 'POST',
          body: JSON.stringify({
            status,
            eventId,
          }),
          signal: AbortSignal.timeout(15_000),
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
    
    
    updateEventConfig: async (config: Partial<EventConfig>) => {
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
        
        const requestBody = { page, enabled, eventId };
        console.log('🔄 [setPageEnabled] Making API request to /api/event/pages:', requestBody);
        
        const response = await authenticatedFetch('/api/event/pages', {
          method: 'POST',
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

    applyRemotePageControl: (data) => {
      const current = getState();
      const newPagesEnabled = {
        requests:
          data.pagesEnabled?.requests ??
          data.requests_page_enabled ??
          (data.page === 'requests' && typeof data.enabled === 'boolean'
            ? data.enabled
            : current.pagesEnabled.requests),
        display:
          data.pagesEnabled?.display ??
          data.display_page_enabled ??
          (data.page === 'display' && typeof data.enabled === 'boolean'
            ? data.enabled
            : current.pagesEnabled.display),
      };

      dispatch({
        type: 'UPDATE_EVENT',
        payload: {
          status: current.status,
          version: Date.now(),
          config: {
            ...current.config,
            pages_enabled: newPagesEnabled,
          },
        },
      });
    },
    
    refreshState: async () => {
      try {
        console.log('🔄 refreshState called');
        // Soft refresh after first hydrate — avoid blanking admin pages on every remount
        const alreadyHydrated = getState().version > 0 || getState().lastUpdated != null;
        if (!alreadyHydrated) {
          dispatch({ type: 'SET_LOADING', payload: true });
        }
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Get current event ID
        const eventId = getState().eventId || getDefaultEventId();
        console.log('📡 Fetching event status for eventId:', eventId);
        
        // Check if we're on a public page (/:username/request or /:username/display)
        const isPublicPage = typeof window !== 'undefined' && 
          (window.location.pathname.includes('/request') || window.location.pathname.includes('/display'));

        const fetchStatus = (url: string) =>
          fetch(url, {
            credentials: 'include',
            signal: AbortSignal.timeout(10_000),
          });
        
        let response;
        
        if (isPublicPage) {
          // Extract username from URL path (/:username/request or /:username/display)
          const pathParts = window.location.pathname.split('/');
          const username = pathParts[1]; // Username is the first path segment
          
          if (username && username !== 'api' && username !== 'login' && username !== 'register') {
            console.log(`🌐 Public page detected, fetching status for username: ${username}`);
            response = await fetchStatus(
              `/api/events/public-status?username=${encodeURIComponent(username)}`
            );
          } else {
            // Fallback to authenticated endpoint
            response = await fetchStatus('/api/event/status');
          }
        } else {
          // Admin/authenticated pages use the authenticated endpoint
          response = await fetchStatus('/api/event/status');
        }
        
        console.log('📡 API response status:', response.status);
        console.log('📡 API response URL:', response.url);
        
        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
            console.error('❌ API error:', errorData);
          } catch (e) {
            // Response body is not JSON
            const text = await response.text();
            console.error('❌ API error (not JSON):', text);
            throw new Error(`Failed to load event state: ${response.status} ${response.statusText}`);
          }
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
  return actions;
}

// Provider component
export function GlobalEventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(globalEventReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pathname = usePathname() || '';
  
  const actions = useMemo(() => {
    const nextActions = createActions(dispatch, () => stateRef.current);
    // Add alias for backward compatibility
    nextActions.setEventStatus = nextActions.updateEventStatus;
    return nextActions;
  }, [dispatch]);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Only rebind when the party owner scope changes — not on every admin sub-route
  // (avoids Pusher reconnect / status-fetch storms on every admin tab change).
  const publicUsername = getPublicPageUsernameFromPath(pathname);
  const isAuthShellPath =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/auth/');
  const partyScopeKey = isAuthShellPath
    ? 'auth-shell'
    : publicUsername
      ? `public:${publicUsername}`
      : 'session';

  // Load / refresh event state when party scope changes
  useEffect(() => {
    if (partyScopeKey === 'auth-shell') {
      return;
    }
    console.log('🚀 GlobalEventProvider refreshState for scope:', partyScopeKey);
    void actionsRef.current.refreshState();
  }, [partyScopeKey]);

  // Listen for Pusher events (state updates and page control changes)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (partyScopeKey === 'auth-shell') return;

    let pusherInstance: ReturnType<
      typeof import('@/lib/pusher').createPusherClient
    > | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelInstance: any = null;
    let cancelled = false;

    const setupPusher = async () => {
      try {
        let userId: string | null = null;

        let channelName: string | null = null;

        // Public display/request: private event channels only (no public event-{id})
        if (publicUsername) {
          const isDisplayPath = pathname.includes('/display');
          if (isDisplayPath) {
            console.log(
              `🌐 [GlobalEventProvider] Display page — display-session for: ${publicUsername}`
            );
            const displayResponse = await fetch('/api/events/display-session', {
              credentials: 'include',
            });
            if (displayResponse.ok) {
              const displayData = await displayResponse.json();
              if (displayData.eventId) {
                const { getDisplayEventChannel } = await import(
                  '@/lib/pusher/channel-contract'
                );
                channelName = getDisplayEventChannel(displayData.eventId);
              }
            }
          }

          if (!channelName) {
            console.log(
              `🌐 [GlobalEventProvider] Public page — guest-session for: ${publicUsername}`
            );
            const guestResponse = await fetch('/api/events/guest-session', {
              credentials: 'include',
            });
            if (guestResponse.ok) {
              const guestData = await guestResponse.json();
              if (guestData.eventId) {
                const { getGuestEventChannel } = await import(
                  '@/lib/pusher/channel-contract'
                );
                channelName = getGuestEventChannel(guestData.eventId);
              }
            }
          }
        }

        // Admin / non-public: authenticated session → legacy user channel
        if (!channelName) {
          const authResponse = await fetch('/api/auth/me', {
            credentials: 'include',
          });
          if (authResponse.ok) {
            const authData = await authResponse.json();
            userId = authData.user?.id;
            if (userId) {
              const { getUserChannel } = await import(
                '@/lib/pusher/client-shared'
              );
              channelName = getUserChannel(userId);
            }
          }
        }

        if (cancelled) return;

        if (!channelName) {
          console.warn(
            '⚠️ [GlobalEventProvider] No Pusher channel resolved, skipping setup'
          );
          return;
        }

        console.log(`📡 [GlobalEventProvider] Setting up Pusher on ${channelName}`);

        const { createPusherClient } = await import(
          '@/lib/pusher/client-shared'
        );
        pusherInstance = createPusherClient();

        channelInstance = pusherInstance.subscribe(channelName);

        channelInstance.bind('state-update', (data: Record<string, unknown>) => {
          console.log(
            '📡 [GlobalEventProvider] Received state-update via Pusher:',
            data
          );
          const dataConfig = (data.config || {}) as Record<string, unknown>;
          dispatch({
            type: 'UPDATE_EVENT',
            payload: {
              status: (data.status as EventState) || stateRef.current.status,
              version: (data.version as number) || Date.now(),
              config: {
                ...stateRef.current.config,
                ...dataConfig,
                pages_enabled: (data.pagesEnabled ||
                  dataConfig.pages_enabled ||
                  stateRef.current.pagesEnabled) as {
                  requests: boolean;
                  display: boolean;
                },
              },
            },
          });
        });

        channelInstance.bind(
          'page-control-toggle',
          (data: {
            pagesEnabled?: { requests?: boolean; display?: boolean };
            page?: 'requests' | 'display';
            enabled?: boolean;
            requests_page_enabled?: boolean;
            display_page_enabled?: boolean;
          }) => {
            console.log(
              '📡 [GlobalEventProvider] Received page-control-toggle via Pusher:',
              data
            );
            actionsRef.current.applyRemotePageControl(data);
            console.log(
              '✅ [GlobalEventProvider] page-control-toggle state updated'
            );
          }
        );
      } catch (error) {
        console.error('❌ [GlobalEventProvider] Failed to setup Pusher:', error);
      }
    };

    void setupPusher();

    return () => {
      cancelled = true;
      if (channelInstance) {
        channelInstance.unbind_all();
        channelInstance.unsubscribe();
      }
      if (pusherInstance) {
        pusherInstance.disconnect();
      }
    };
  }, [partyScopeKey, publicUsername]);

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
    updateEventConfig: async (config: Partial<EventConfig>) => {
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
