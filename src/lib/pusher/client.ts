/**
 * Centralized Pusher Client with Event Deduplication and Ordering
 * 
 * This module provides a robust Pusher client that handles:
 * - Single channel per event with action-based events
 * - Event deduplication and ordering
 * - Automatic reconnection and state recovery
 * - Rate limiting and error handling
 */

import PusherClient from 'pusher-js';
import { 
  PusherEvent, 
  EventHandlers, 
  getEventChannel, 
  generateEventId, 
  generateEventVersion,
  isValidEvent,
  getEventDeduplicationKey,
  compareEvents,
  EventId,
  EventTimestamp,
  EventVersion
} from './events';
import { 
  EventDeduplicationManager, 
  getDeduplicationManager 
} from './deduplication';
import { 
  ReconnectionManager, 
  getReconnectionManager 
} from './reconnection';
import { 
  FallbackManager, 
  getFallbackManager 
} from './fallback';
import { 
  RateLimiter, 
  getRateLimiter 
} from './rate-limiter';

// Connection state
export type ConnectionState = 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting';

// Event deduplication store
interface EventStore {
  processed: Set<string>;
  pending: Map<string, PusherEvent>;
  lastProcessed: Map<string, EventTimestamp>;
}

// Rate limiting configuration
interface RateLimitConfig {
  maxEventsPerSecond: number;
  maxEventsPerMinute: number;
  burstLimit: number;
}

// Client configuration
interface PusherClientConfig {
  key: string;
  cluster: string;
  forceTLS: boolean;
  enabledTransports: string[];
  disabledTransports: string[];
  rateLimit: RateLimitConfig;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
}

// Default configuration
const DEFAULT_CONFIG: PusherClientConfig = {
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'fallback-key',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
  forceTLS: true,
  enabledTransports: ['ws', 'wss'],
  disabledTransports: [],
  rateLimit: {
    maxEventsPerSecond: 10,
    maxEventsPerMinute: 100,
    burstLimit: 5
  },
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000
};

export class CentralizedPusherClient {
  private client: PusherClient | null = null;
  private eventId: string | null = null;
  private channel: any = null;
  private handlers: EventHandlers = {};
  private connectionState: ConnectionState = 'initializing';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventStore: EventStore = {
    processed: new Set(),
    pending: new Map(),
    lastProcessed: new Map()
  };
  private rateLimitCounters = {
    perSecond: 0,
    perMinute: 0,
    lastSecond: 0,
    lastMinute: 0
  };
  private deduplicationManager: EventDeduplicationManager;
  private reconnectionManager: ReconnectionManager;
  private fallbackManager: FallbackManager;
  private rateLimiter: RateLimiter;
  private config: PusherClientConfig;

  constructor(config: Partial<PusherClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deduplicationManager = getDeduplicationManager();
    this.reconnectionManager = getReconnectionManager();
    this.fallbackManager = getFallbackManager();
    this.rateLimiter = getRateLimiter();
  }

  // Initialize the client
  async initialize(eventId: string): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    this.eventId = eventId;
    this.connectionState = 'initializing';

    try {
      this.client = new PusherClient(this.config.key, {
        cluster: this.config.cluster,
        forceTLS: this.config.forceTLS,
        enabledTransports: this.config.enabledTransports,
        disabledTransports: this.config.disabledTransports,
        authEndpoint: '/api/pusher/auth',
        auth: {
          headers: {
            'X-Event-ID': eventId
          }
        }
      });

      this.setupConnectionListeners();
      await this.subscribeToEventChannel();
      this.startHeartbeat();
      
      // Initialize reconnection manager
      await this.reconnectionManager.initialize(eventId);
      
      // Initialize fallback manager
      await this.fallbackManager.initialize(eventId);
      
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ Failed to initialize Pusher client:', error);
      this.connectionState = 'failed';
      throw error;
    }
  }

  // Setup connection event listeners
  private setupConnectionListeners(): void {
    if (!this.client) return;

    this.client.connection.bind('connecting', () => {
      console.log('🔄 Pusher connecting...');
      this.connectionState = 'connecting';
    });

    this.client.connection.bind('connected', () => {
      console.log('✅ Pusher connected!');
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
    });

    this.client.connection.bind('disconnected', () => {
      console.log('❌ Pusher disconnected');
      this.connectionState = 'disconnected';
      this.handleDisconnection();
    });

    this.client.connection.bind('failed', () => {
      console.log('💥 Pusher connection failed');
      this.connectionState = 'failed';
      this.handleConnectionFailure();
    });

    this.client.connection.bind('unavailable', () => {
      console.log('⚠️ Pusher unavailable');
      this.connectionState = 'failed';
      this.handleConnectionFailure();
    });
  }

  // Subscribe to event channel
  private async subscribeToEventChannel(): Promise<void> {
    if (!this.client || !this.eventId) return;

    const channelName = getEventChannel(this.eventId);
    this.channel = this.client.subscribe(channelName);

    // Bind to the unified event handler
    this.channel.bind('event', (data: any) => {
      this.handleEvent(data);
    });

    console.log(`📡 Subscribed to channel: ${channelName}`);
  }

  // Handle incoming events
  private handleEvent(data: any): void {
    try {
      // Validate event
      if (!isValidEvent(data)) {
        console.warn('⚠️ Invalid event received:', data);
        return;
      }

      const event = data as PusherEvent;

      // Check rate limiting
      const rateLimitResult = this.rateLimiter.checkRateLimit(event, undefined, this.eventId);
      if (!rateLimitResult.allowed) {
        console.warn('⚠️ Rate limit exceeded, dropping event:', event.id, rateLimitResult.reason);
        return;
      }

      // Process event through deduplication manager
      this.deduplicationManager.processEvent(event).then(processed => {
        if (processed) {
          console.log(`📨 Event processed: ${event.action}`, event.id);
        }
      }).catch(error => {
        console.error('❌ Error processing event through deduplication manager:', error);
      });

    } catch (error) {
      console.error('❌ Error handling event:', error, data);
    }
  }

  // Process individual event
  private processEvent(event: PusherEvent): void {
    const handler = this.handlers[event.action];
    if (handler) {
      try {
        handler(event);
        console.log(`📨 Event processed: ${event.action}`, event.id);
      } catch (error) {
        console.error(`❌ Error processing event ${event.action}:`, error);
      }
    } else {
      console.log(`📨 No handler for event: ${event.action}`);
    }
  }

  // Check rate limiting
  private checkRateLimit(): boolean {
    const now = Date.now();
    const second = Math.floor(now / 1000);
    const minute = Math.floor(now / 60000);

    // Reset counters if time window changed
    if (second !== this.rateLimitCounters.lastSecond) {
      this.rateLimitCounters.perSecond = 0;
      this.rateLimitCounters.lastSecond = second;
    }
    if (minute !== this.rateLimitCounters.lastMinute) {
      this.rateLimitCounters.perMinute = 0;
      this.rateLimitCounters.lastMinute = minute;
    }

    // Check limits
    if (this.rateLimitCounters.perSecond >= this.config.rateLimit.maxEventsPerSecond) {
      return false;
    }
    if (this.rateLimitCounters.perMinute >= this.config.rateLimit.maxEventsPerMinute) {
      return false;
    }

    // Increment counters
    this.rateLimitCounters.perSecond++;
    this.rateLimitCounters.perMinute++;

    return true;
  }

  // Handle disconnection
  private handleDisconnection(): void {
    this.stopHeartbeat();
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error('💥 Max reconnection attempts reached');
      this.connectionState = 'failed';
    }
  }

  // Handle connection failure
  private handleConnectionFailure(): void {
    this.stopHeartbeat();
    this.scheduleReconnect();
  }

  // Schedule reconnection
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connectionState = 'reconnecting';
      this.reconnect();
    }, delay);
  }

  // Attempt reconnection
  private async reconnect(): Promise<void> {
    if (!this.eventId) return;

    try {
      console.log('🔄 Attempting to reconnect...');
      await this.initialize(this.eventId);
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      this.handleConnectionFailure();
    }
  }

  // Start heartbeat
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.sendHeartbeat();
      }
    }, this.config.heartbeatInterval);
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Send heartbeat
  private sendHeartbeat(): void {
    // This would typically send a heartbeat event to the server
    // For now, we'll just log it
    console.log('💓 Heartbeat sent');
  }

  // Set event handlers
  setHandlers(handlers: EventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
    
    // Register handlers with deduplication manager
    Object.entries(handlers).forEach(([action, handler]) => {
      if (handler) {
        this.deduplicationManager.registerHandler(action, handler);
      }
    });
  }

  // Get connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Check if connected
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // Get event statistics
  getEventStats(): {
    processed: number;
    pending: number;
    lastProcessed: Record<string, EventTimestamp>;
    deduplication: ReturnType<EventDeduplicationManager['getStatistics']>;
    reconnection: ReturnType<ReconnectionManager['getStatistics']>;
    rateLimiting: ReturnType<RateLimiter['getStatistics']>;
  } {
    return {
      processed: this.eventStore.processed.size,
      pending: this.eventStore.pending.size,
      lastProcessed: Object.fromEntries(this.eventStore.lastProcessed),
      deduplication: this.deduplicationManager.getStatistics(),
      reconnection: this.reconnectionManager.getStatistics(),
      rateLimiting: this.rateLimiter.getStatistics()
    };
  }

  // Clear processed events (for cleanup)
  clearProcessedEvents(): void {
    this.eventStore.processed.clear();
    this.eventStore.pending.clear();
    this.eventStore.lastProcessed.clear();
  }

  // Disconnect
  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel && this.client) {
      this.client.unsubscribe(getEventChannel(this.eventId!));
    }

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
    this.clearProcessedEvents();
    
    // Cleanup reconnection manager
    this.reconnectionManager.destroy();
  }
}

// Singleton instance
let pusherClient: CentralizedPusherClient | null = null;

// Get or create singleton instance
export const getPusherClient = (config?: Partial<PusherClientConfig>): CentralizedPusherClient => {
  if (!pusherClient) {
    pusherClient = new CentralizedPusherClient(config);
  }
  return pusherClient;
};

// Cleanup function
export const cleanupPusherClient = async (): Promise<void> => {
  if (pusherClient) {
    await pusherClient.disconnect();
    pusherClient = null;
  }
};
