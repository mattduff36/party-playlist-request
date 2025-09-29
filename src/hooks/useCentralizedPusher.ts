/**
 * Centralized Pusher Hook
 * 
 * This hook provides a clean interface to the centralized Pusher system
 * with automatic event handling, deduplication, and state management.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  CentralizedPusherClient, 
  getPusherClient, 
  cleanupPusherClient,
  ConnectionState 
} from '@/lib/pusher/client';
import { 
  PusherEvent, 
  EventHandlers, 
  EventHandler 
} from '@/lib/pusher/events';
import { useGlobalEvent } from '@/lib/state/global-event-client';

// Hook options
interface UseCentralizedPusherOptions {
  eventHandlers?: EventHandlers;
  autoConnect?: boolean;
  reconnectOnFocus?: boolean;
  debug?: boolean;
}

// Hook return type
interface UseCentralizedPusherReturn {
  isConnected: boolean;
  connectionState: ConnectionState;
  eventStats: {
    processed: number;
    pending: number;
    lastProcessed: Record<string, number>;
  };
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  addEventHandler: <T extends PusherEvent>(action: T['action'], handler: EventHandler<T>) => void;
  removeEventHandler: (action: string) => void;
}

export const useCentralizedPusher = (options: UseCentralizedPusherOptions = {}): UseCentralizedPusherReturn => {
  const {
    eventHandlers = {},
    autoConnect = true,
    reconnectOnFocus = true,
    debug = false
  } = options;

  // Global state
  const { state: globalState } = useGlobalEvent();
  
  // Local state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('initializing');
  const [eventStats, setEventStats] = useState({
    processed: 0,
    pending: 0,
    lastProcessed: {} as Record<string, number>
  });

  // Refs
  const clientRef = useRef<CentralizedPusherClient | null>(null);
  const handlersRef = useRef<EventHandlers>(eventHandlers);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  // Initialize client
  const initializeClient = useCallback(async () => {
    if (!globalState.eventId) {
      if (debug) console.log('🔄 No event ID available, waiting...');
      return;
    }

    try {
      const client = getPusherClient();
      clientRef.current = client;

      // Set up connection state listener
      const checkConnectionState = () => {
        const state = client.getConnectionState();
        setConnectionState(state);
        setIsConnected(state === 'connected');
      };

      // Check connection state periodically
      const stateInterval = setInterval(checkConnectionState, 1000);
      
      // Set up event handlers
      client.setHandlers(handlersRef.current);

      // Initialize if not already connected
      if (!client.isConnected()) {
        await client.initialize(globalState.eventId);
      }

      checkConnectionState();

      // Set up stats monitoring
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      
      statsIntervalRef.current = setInterval(() => {
        if (clientRef.current) {
          const stats = clientRef.current.getEventStats();
          setEventStats(stats);
        }
      }, 5000);

      if (debug) console.log('✅ Pusher client initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Pusher client:', error);
      setConnectionState('failed');
      setIsConnected(false);
    }
  }, [globalState.eventId, debug]);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect) {
      initializeClient();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [autoConnect, initializeClient]);

  // Reconnect on focus
  useEffect(() => {
    if (!reconnectOnFocus) return;

    const handleFocus = () => {
      if (clientRef.current && !clientRef.current.isConnected()) {
        if (debug) console.log('🔄 Window focused, attempting reconnection...');
        initializeClient();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reconnectOnFocus, initializeClient, debug]);

  // Reconnect function
  const reconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
    }
    await initializeClient();
  }, [initializeClient]);

  // Disconnect function
  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
    }
    setConnectionState('disconnected');
    setIsConnected(false);
  }, []);

  // Add event handler
  const addEventHandler = useCallback(<T extends PusherEvent>(
    action: T['action'], 
    handler: EventHandler<T>
  ) => {
    if (clientRef.current) {
      const newHandlers = {
        ...handlersRef.current,
        [action]: handler as EventHandler
      };
      handlersRef.current = newHandlers;
      clientRef.current.setHandlers(newHandlers);
    }
  }, []);

  // Remove event handler
  const removeEventHandler = useCallback((action: string) => {
    if (clientRef.current) {
      const newHandlers = { ...handlersRef.current };
      delete newHandlers[action as keyof EventHandlers];
      handlersRef.current = newHandlers;
      clientRef.current.setHandlers(newHandlers);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    connectionState,
    eventStats,
    reconnect,
    disconnect,
    addEventHandler,
    removeEventHandler
  };
};

// Convenience hook for specific event types
export const usePusherEvent = <T extends PusherEvent>(
  action: T['action'],
  handler: EventHandler<T>,
  deps: any[] = []
) => {
  const { addEventHandler, removeEventHandler } = useCentralizedPusher();

  useEffect(() => {
    addEventHandler(action, handler);
    return () => removeEventHandler(action);
  }, [action, addEventHandler, removeEventHandler, ...deps]);
};

// Hook for connection status
export const usePusherConnection = () => {
  const { isConnected, connectionState, reconnect, disconnect } = useCentralizedPusher();
  
  return {
    isConnected,
    connectionState,
    reconnect,
    disconnect
  };
};

// Hook for event statistics
export const usePusherStats = () => {
  const { eventStats } = useCentralizedPusher();
  
  return eventStats;
};
