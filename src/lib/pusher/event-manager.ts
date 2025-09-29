/**
 * Centralized Event Manager
 * 
 * This module provides a centralized event management system that coordinates
 * between the Pusher client, event broadcasting, and application state.
 */

import { 
  CentralizedPusherClient, 
  getPusherClient, 
  cleanupPusherClient 
} from './client';
import { 
  EventBroadcaster, 
  broadcastEvent, 
  broadcastEvents 
} from './broadcaster';
import { 
  PusherEvent, 
  EventHandlers, 
  EventHandler,
  EventAction,
  generateEventId,
  generateEventVersion
} from './events';

// Event manager configuration
interface EventManagerConfig {
  enableDeduplication: boolean;
  enableOrdering: boolean;
  enableRateLimiting: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  compressionThreshold: number;
}

const DEFAULT_CONFIG: EventManagerConfig = {
  enableDeduplication: true,
  enableOrdering: true,
  enableRateLimiting: true,
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 10,
  compressionThreshold: 1024
};

// Event manager state
interface EventManagerState {
  isInitialized: boolean;
  eventId: string | null;
  isConnected: boolean;
  connectionState: string;
  eventCount: number;
  errorCount: number;
  lastError: Error | null;
}

export class EventManager {
  private config: EventManagerConfig;
  private state: EventManagerState;
  private client: CentralizedPusherClient | null = null;
  private broadcaster: EventBroadcaster;
  private handlers: Map<EventAction, Set<EventHandler>> = new Map();
  private eventQueue: Array<{ event: PusherEvent; resolve: () => void; reject: (error: Error) => void }> = [];
  private processingQueue = false;

  constructor(config: Partial<EventManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.broadcaster = new EventBroadcaster({
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      batchSize: this.config.batchSize,
      compressionThreshold: this.config.compressionThreshold
    });
    this.state = {
      isInitialized: false,
      eventId: null,
      isConnected: false,
      connectionState: 'initializing',
      eventCount: 0,
      errorCount: 0,
      lastError: null
    };
  }

  // Initialize the event manager
  async initialize(eventId: string): Promise<void> {
    try {
      this.state.eventId = eventId;
      
      // Initialize Pusher client
      this.client = getPusherClient();
      await this.client.initialize(eventId);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.state.isInitialized = true;
      this.state.isConnected = this.client.isConnected();
      this.state.connectionState = this.client.getConnectionState();
      
      console.log('✅ Event manager initialized for event:', eventId);
    } catch (error) {
      console.error('❌ Failed to initialize event manager:', error);
      this.state.lastError = error as Error;
      this.state.errorCount++;
      throw error;
    }
  }

  // Set up event handlers
  private setupEventHandlers(): void {
    if (!this.client) return;

    const handlers: EventHandlers = {};
    
    // Create a unified event handler
    const unifiedHandler: EventHandler = (event: PusherEvent) => {
      this.handleIncomingEvent(event);
    };

    // Set up handlers for all event types
    const eventActions: EventAction[] = [
      'state_update',
      'request_approved',
      'request_rejected',
      'request_submitted',
      'request_deleted',
      'playback_update',
      'page_control_toggle',
      'admin_login',
      'admin_logout',
      'token_expired',
      'stats_update',
      'error_occurred',
      'heartbeat'
    ];

    eventActions.forEach(action => {
      handlers[action] = unifiedHandler;
    });

    this.client.setHandlers(handlers);
  }

  // Handle incoming events
  private handleIncomingEvent(event: PusherEvent): void {
    try {
      this.state.eventCount++;
      
      // Get handlers for this event action
      const actionHandlers = this.handlers.get(event.action);
      if (actionHandlers) {
        actionHandlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error(`❌ Error in event handler for ${event.action}:`, error);
            this.state.errorCount++;
            this.state.lastError = error as Error;
          }
        });
      }
      
      console.log(`📨 Event processed: ${event.action}`, event.id);
    } catch (error) {
      console.error('❌ Error handling incoming event:', error);
      this.state.errorCount++;
      this.state.lastError = error as Error;
    }
  }

  // Add event handler
  addEventHandler<T extends PusherEvent>(action: T['action'], handler: EventHandler<T>): void {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, new Set());
    }
    
    this.handlers.get(action)!.add(handler as EventHandler);
    
    console.log(`📝 Event handler added for: ${action}`);
  }

  // Remove event handler
  removeEventHandler<T extends PusherEvent>(action: T['action'], handler: EventHandler<T>): void {
    const actionHandlers = this.handlers.get(action);
    if (actionHandlers) {
      actionHandlers.delete(handler as EventHandler);
      if (actionHandlers.size === 0) {
        this.handlers.delete(action);
      }
    }
    
    console.log(`🗑️ Event handler removed for: ${action}`);
  }

  // Broadcast event
  async broadcastEvent(event: Omit<PusherEvent, 'id' | 'timestamp' | 'version'>): Promise<void> {
    if (!this.state.eventId) {
      throw new Error('Event manager not initialized');
    }

    try {
      const fullEvent: PusherEvent = {
        ...event,
        id: generateEventId(),
        timestamp: Date.now(),
        version: generateEventVersion()
      } as PusherEvent;

      await broadcastEvent(fullEvent, this.state.eventId);
      console.log(`📡 Event broadcasted: ${event.action}`, fullEvent.id);
    } catch (error) {
      console.error('❌ Failed to broadcast event:', error);
      this.state.errorCount++;
      this.state.lastError = error as Error;
      throw error;
    }
  }

  // Broadcast multiple events
  async broadcastEvents(events: Array<Omit<PusherEvent, 'id' | 'timestamp' | 'version'>>): Promise<void> {
    if (!this.state.eventId) {
      throw new Error('Event manager not initialized');
    }

    try {
      const fullEvents: PusherEvent[] = events.map(event => ({
        ...event,
        id: generateEventId(),
        timestamp: Date.now(),
        version: generateEventVersion()
      } as PusherEvent));

      await broadcastEvents(fullEvents, this.state.eventId);
      console.log(`📡 Events broadcasted: ${events.length} events`);
    } catch (error) {
      console.error('❌ Failed to broadcast events:', error);
      this.state.errorCount++;
      this.state.lastError = error as Error;
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus(): {
    isConnected: boolean;
    connectionState: string;
    isInitialized: boolean;
  } {
    return {
      isConnected: this.state.isConnected,
      connectionState: this.state.connectionState,
      isInitialized: this.state.isInitialized
    };
  }

  // Get statistics
  getStatistics(): {
    eventCount: number;
    errorCount: number;
    lastError: Error | null;
    handlerCount: number;
    queueLength: number;
  } {
    const handlerCount = Array.from(this.handlers.values())
      .reduce((total, handlers) => total + handlers.size, 0);

    return {
      eventCount: this.state.eventCount,
      errorCount: this.state.errorCount,
      lastError: this.state.lastError,
      handlerCount,
      queueLength: this.eventQueue.length
    };
  }

  // Reconnect
  async reconnect(): Promise<void> {
    if (!this.state.eventId) {
      throw new Error('Event manager not initialized');
    }

    try {
      await this.initialize(this.state.eventId);
      console.log('🔄 Event manager reconnected');
    } catch (error) {
      console.error('❌ Failed to reconnect event manager:', error);
      throw error;
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      
      this.state.isConnected = false;
      this.state.connectionState = 'disconnected';
      
      console.log('🔌 Event manager disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting event manager:', error);
      throw error;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      await this.disconnect();
      await cleanupPusherClient();
      
      this.handlers.clear();
      this.eventQueue = [];
      this.state = {
        isInitialized: false,
        eventId: null,
        isConnected: false,
        connectionState: 'initializing',
        eventCount: 0,
        errorCount: 0,
        lastError: null
      };
      
      console.log('🧹 Event manager cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up event manager:', error);
      throw error;
    }
  }
}

// Singleton event manager instance
let eventManager: EventManager | null = null;

// Get or create singleton instance
export const getEventManager = (config?: Partial<EventManagerConfig>): EventManager => {
  if (!eventManager) {
    eventManager = new EventManager(config);
  }
  return eventManager;
};

// Cleanup function
export const cleanupEventManager = async (): Promise<void> => {
  if (eventManager) {
    await eventManager.cleanup();
    eventManager = null;
  }
};

// Convenience functions
export const initializeEventManager = async (eventId: string, config?: Partial<EventManagerConfig>): Promise<EventManager> => {
  const manager = getEventManager(config);
  await manager.initialize(eventId);
  return manager;
};

export const addEventHandler = <T extends PusherEvent>(action: T['action'], handler: EventHandler<T>): void => {
  const manager = getEventManager();
  manager.addEventHandler(action, handler);
};

export const removeEventHandler = <T extends PusherEvent>(action: T['action'], handler: EventHandler<T>): void => {
  const manager = getEventManager();
  manager.removeEventHandler(action, handler);
};

export const broadcastEvent = async (event: Omit<PusherEvent, 'id' | 'timestamp' | 'version'>): Promise<void> => {
  const manager = getEventManager();
  await manager.broadcastEvent(event);
};

export const broadcastEvents = async (events: Array<Omit<PusherEvent, 'id' | 'timestamp' | 'version'>>): Promise<void> => {
  const manager = getEventManager();
  await manager.broadcastEvents(events);
};

export const getConnectionStatus = () => {
  const manager = getEventManager();
  return manager.getConnectionStatus();
};

export const getStatistics = () => {
  const manager = getEventManager();
  return manager.getStatistics();
};
