/**
 * Event Manager Hook
 * 
 * This hook provides a clean interface to the centralized event manager
 * with automatic initialization and cleanup.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  EventManager, 
  getEventManager, 
  cleanupEventManager,
  addEventHandler,
  removeEventHandler,
  broadcastEvent,
  broadcastEvents,
  getConnectionStatus,
  getStatistics
} from '@/lib/pusher/event-manager';
import { 
  PusherEvent, 
  EventHandler, 
  EventAction 
} from '@/lib/pusher/events';
import { useGlobalEvent } from '@/lib/state/global-event';

// Hook options
interface UseEventManagerOptions {
  autoInitialize?: boolean;
  autoCleanup?: boolean;
  debug?: boolean;
}

// Hook return type
interface UseEventManagerReturn {
  isInitialized: boolean;
  isConnected: boolean;
  connectionState: string;
  statistics: {
    eventCount: number;
    errorCount: number;
    lastError: Error | null;
    handlerCount: number;
    queueLength: number;
  };
  addEventHandler: <T extends PusherEvent>(action: T['action'], handler: EventHandler<T>) => void;
  removeEventHandler: <T extends PusherEvent>(action: T['action'], handler: EventHandler<T>) => void;
  broadcastEvent: (event: Omit<PusherEvent, 'id' | 'timestamp' | 'version'>) => Promise<void>;
  broadcastEvents: (events: Array<Omit<PusherEvent, 'id' | 'timestamp' | 'version'>>) => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useEventManager = (options: UseEventManagerOptions = {}): UseEventManagerReturn => {
  const {
    autoInitialize = true,
    autoCleanup = true,
    debug = false
  } = options;

  // Global state
  const { state: globalState } = useGlobalEvent();
  
  // Local state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [statistics, setStatistics] = useState({
    eventCount: 0,
    errorCount: 0,
    lastError: null as Error | null,
    handlerCount: 0,
    queueLength: 0
  });

  // Refs
  const managerRef = useRef<EventManager | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize event manager
  const initializeManager = useCallback(async () => {
    if (!globalState.eventId) {
      if (debug) console.log('🔄 No event ID available, waiting...');
      return;
    }

    try {
      const manager = getEventManager();
      await manager.initialize(globalState.eventId);
      managerRef.current = manager;
      
      setIsInitialized(true);
      
      if (debug) console.log('✅ Event manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize event manager:', error);
      setIsInitialized(false);
    }
  }, [globalState.eventId, debug]);

  // Update connection status
  const updateConnectionStatus = useCallback(() => {
    if (managerRef.current) {
      const status = managerRef.current.getConnectionStatus();
      setIsConnected(status.isConnected);
      setConnectionState(status.connectionState);
    }
  }, []);

  // Update statistics
  const updateStatistics = useCallback(() => {
    if (managerRef.current) {
      const stats = managerRef.current.getStatistics();
      setStatistics(stats);
    }
  }, []);

  // Auto-initialize effect
  useEffect(() => {
    if (autoInitialize) {
      initializeManager();
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [autoInitialize, initializeManager]);

  // Set up monitoring intervals
  useEffect(() => {
    if (isInitialized) {
      // Update connection status every second
      statusIntervalRef.current = setInterval(updateConnectionStatus, 1000);
      
      // Update statistics every 5 seconds
      statsIntervalRef.current = setInterval(updateStatistics, 5000);
      
      // Initial update
      updateConnectionStatus();
      updateStatistics();
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [isInitialized, updateConnectionStatus, updateStatistics]);

  // Add event handler
  const addEventHandlerCallback = useCallback(<T extends PusherEvent>(
    action: T['action'], 
    handler: EventHandler<T>
  ) => {
    addEventHandler(action, handler);
  }, []);

  // Remove event handler
  const removeEventHandlerCallback = useCallback(<T extends PusherEvent>(
    action: T['action'], 
    handler: EventHandler<T>
  ) => {
    removeEventHandler(action, handler);
  }, []);

  // Broadcast event
  const broadcastEventCallback = useCallback(async (
    event: Omit<PusherEvent, 'id' | 'timestamp' | 'version'>
  ) => {
    await broadcastEvent(event);
  }, []);

  // Broadcast events
  const broadcastEventsCallback = useCallback(async (
    events: Array<Omit<PusherEvent, 'id' | 'timestamp' | 'version'>>
  ) => {
    await broadcastEvents(events);
  }, []);

  // Reconnect
  const reconnect = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.reconnect();
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.disconnect();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCleanup && managerRef.current) {
        managerRef.current.cleanup();
      }
    };
  }, [autoCleanup]);

  return {
    isInitialized,
    isConnected,
    connectionState,
    statistics,
    addEventHandler: addEventHandlerCallback,
    removeEventHandler: removeEventHandlerCallback,
    broadcastEvent: broadcastEventCallback,
    broadcastEvents: broadcastEventsCallback,
    reconnect,
    disconnect
  };
};

// Convenience hook for specific event types
export const useEventHandler = <T extends PusherEvent>(
  action: T['action'],
  handler: EventHandler<T>,
  deps: any[] = []
) => {
  const { addEventHandler, removeEventHandler } = useEventManager();

  useEffect(() => {
    addEventHandler(action, handler);
    return () => removeEventHandler(action, handler);
  }, [action, addEventHandler, removeEventHandler, ...deps]);
};

// Hook for connection status only
export const useEventManagerConnection = () => {
  const { isInitialized, isConnected, connectionState, reconnect, disconnect } = useEventManager();
  
  return {
    isInitialized,
    isConnected,
    connectionState,
    reconnect,
    disconnect
  };
};

// Hook for statistics only
export const useEventManagerStats = () => {
  const { statistics } = useEventManager();
  
  return statistics;
};
