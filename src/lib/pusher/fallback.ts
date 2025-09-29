/**
 * Fallback Mechanisms for Pusher Connection Failures
 * 
 * This module provides fallback mechanisms when Pusher connections fail,
 * including polling, local storage, and graceful degradation.
 */

import { 
  PusherEvent, 
  EventAction,
  generateEventId,
  generateEventVersion
} from './events';

// Fallback configuration
interface FallbackConfig {
  enablePolling: boolean;
  enableLocalStorage: boolean;
  enableGracefulDegradation: boolean;
  pollingInterval: number;
  maxPollingAttempts: number;
  localStorageKey: string;
  localStorageExpiry: number;
  degradationTimeout: number;
  retryAfterFailure: boolean;
  maxRetryAttempts: number;
}

const DEFAULT_CONFIG: FallbackConfig = {
  enablePolling: true,
  enableLocalStorage: true,
  enableGracefulDegradation: true,
  pollingInterval: 5000,
  maxPollingAttempts: 10,
  localStorageKey: 'pusher-fallback-events',
  localStorageExpiry: 300000, // 5 minutes
  degradationTimeout: 10000,
  retryAfterFailure: true,
  maxRetryAttempts: 3
};

// Fallback state
interface FallbackState {
  isActive: boolean;
  mode: 'pusher' | 'polling' | 'localStorage' | 'degraded';
  lastSuccessfulConnection: number;
  consecutiveFailures: number;
  pollingAttempts: number;
  retryAttempts: number;
  eventsInQueue: number;
  lastEventProcessed: number;
}

// Event queue entry
interface QueuedEvent {
  event: PusherEvent;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
}

export class FallbackManager {
  private config: FallbackConfig;
  private state: FallbackState;
  private eventQueue: QueuedEvent[] = [];
  private pollingTimer: NodeJS.Timeout | null = null;
  private degradationTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<EventAction, (event: PusherEvent) => void> = new Map();
  private isDestroyed = false;
  private eventId: string | null = null;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isActive: false,
      mode: 'pusher',
      lastSuccessfulConnection: Date.now(),
      consecutiveFailures: 0,
      pollingAttempts: 0,
      retryAttempts: 0,
      eventsInQueue: 0,
      lastEventProcessed: 0
    };
  }

  // Initialize fallback manager
  async initialize(eventId: string): Promise<void> {
    this.eventId = eventId;
    this.state.isActive = true;
    
    // Load events from localStorage if available
    if (this.config.enableLocalStorage) {
      await this.loadEventsFromStorage();
    }

    console.log('✅ Fallback manager initialized');
  }

  // Handle Pusher connection failure
  async handleConnectionFailure(): Promise<void> {
    if (this.isDestroyed) return;

    this.state.consecutiveFailures++;
    this.state.lastSuccessfulConnection = Date.now();

    console.log(`❌ Pusher connection failed (failure ${this.state.consecutiveFailures})`);

    // Determine fallback strategy
    if (this.config.enablePolling && this.state.consecutiveFailures <= this.config.maxPollingAttempts) {
      await this.activatePollingMode();
    } else if (this.config.enableLocalStorage) {
      await this.activateLocalStorageMode();
    } else if (this.config.enableGracefulDegradation) {
      await this.activateDegradedMode();
    }
  }

  // Handle Pusher connection success
  async handleConnectionSuccess(): Promise<void> {
    if (this.isDestroyed) return;

    this.state.consecutiveFailures = 0;
    this.state.lastSuccessfulConnection = Date.now();
    this.state.mode = 'pusher';
    this.state.pollingAttempts = 0;
    this.state.retryAttempts = 0;

    // Stop fallback mechanisms
    this.stopPolling();
    this.stopDegradationTimer();

    // Process any queued events
    await this.processQueuedEvents();

    console.log('✅ Pusher connection restored, fallback deactivated');
  }

  // Activate polling mode
  private async activatePollingMode(): Promise<void> {
    this.state.mode = 'polling';
    this.state.pollingAttempts = 0;

    console.log('🔄 Activating polling fallback mode');

    // Start polling
    this.startPolling();
  }

  // Start polling
  private startPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.pollingTimer = setInterval(async () => {
      await this.performPolling();
    }, this.config.pollingInterval);
  }

  // Stop polling
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // Perform polling
  private async performPolling(): Promise<void> {
    if (this.isDestroyed || !this.eventId) return;

    try {
      this.state.pollingAttempts++;

      // Poll for new events
      const events = await this.pollForEvents();
      
      if (events.length > 0) {
        console.log(`📡 Polling received ${events.length} events`);
        
        // Process events
        for (const event of events) {
          await this.processEvent(event);
        }
        
        // Reset failure count on successful polling
        this.state.consecutiveFailures = 0;
      }

      // Check if we should stop polling
      if (this.state.pollingAttempts >= this.config.maxPollingAttempts) {
        console.log('⚠️ Max polling attempts reached, switching to next fallback');
        await this.activateLocalStorageMode();
      }

    } catch (error) {
      console.error('❌ Polling failed:', error);
      
      // Check if we should switch to next fallback
      if (this.state.pollingAttempts >= this.config.maxPollingAttempts) {
        await this.activateLocalStorageMode();
      }
    }
  }

  // Poll for events from server
  private async pollForEvents(): Promise<PusherEvent[]> {
    if (!this.eventId) return [];

    try {
      const response = await fetch(`/api/events/poll?eventId=${this.eventId}&since=${this.state.lastEventProcessed}`);
      
      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`);
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('❌ Failed to poll for events:', error);
      return [];
    }
  }

  // Activate localStorage mode
  private async activateLocalStorageMode(): Promise<void> {
    this.state.mode = 'localStorage';
    this.stopPolling();

    console.log('💾 Activating localStorage fallback mode');

    // Process events from localStorage
    await this.processLocalStorageEvents();
  }

  // Process events from localStorage
  private async processLocalStorageEvents(): Promise<void> {
    try {
      const storedEvents = this.getStoredEvents();
      
      if (storedEvents.length > 0) {
        console.log(`💾 Processing ${storedEvents.length} events from localStorage`);
        
        for (const event of storedEvents) {
          await this.processEvent(event);
        }
        
        // Clear processed events
        this.clearStoredEvents();
      }
    } catch (error) {
      console.error('❌ Failed to process localStorage events:', error);
    }
  }

  // Activate degraded mode
  private async activateDegradedMode(): Promise<void> {
    this.state.mode = 'degraded';
    this.stopPolling();

    console.log('⚠️ Activating degraded mode - limited functionality');

    // Set degradation timer
    this.degradationTimer = setTimeout(() => {
      console.log('⏰ Degradation timeout reached');
      this.handleDegradationTimeout();
    }, this.config.degradationTimeout);
  }

  // Handle degradation timeout
  private handleDegradationTimeout(): void {
    console.log('💥 Degradation timeout - system may be unstable');
    
    // Notify handlers of degradation
    this.notifyHandlers('error_occurred', {
      id: generateEventId(),
      timestamp: Date.now(),
      version: generateEventVersion(),
      eventId: this.eventId || '',
      action: 'error_occurred',
      data: {
        errorType: 'connection',
        message: 'System degraded due to connection failures',
        severity: 'high',
        service: 'pusher-fallback'
      }
    });
  }

  // Stop degradation timer
  private stopDegradationTimer(): void {
    if (this.degradationTimer) {
      clearTimeout(this.degradationTimer);
      this.degradationTimer = null;
    }
  }

  // Queue event for processing
  queueEvent(event: PusherEvent, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    const queuedEvent: QueuedEvent = {
      event,
      timestamp: Date.now(),
      retryCount: 0,
      priority
    };

    this.eventQueue.push(queuedEvent);
    this.state.eventsInQueue = this.eventQueue.length;

    // Store in localStorage if enabled
    if (this.config.enableLocalStorage) {
      this.storeEvent(event);
    }

    console.log(`📥 Event queued: ${event.action} (priority: ${priority})`);
  }

  // Process queued events
  private async processQueuedEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    console.log(`🔄 Processing ${this.eventQueue.length} queued events`);

    // Sort by priority and timestamp
    this.eventQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp - b.timestamp;
    });

    // Process events
    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];

    for (const queuedEvent of eventsToProcess) {
      try {
        await this.processEvent(queuedEvent.event);
        this.state.lastEventProcessed = Date.now();
      } catch (error) {
        console.error('❌ Failed to process queued event:', error);
        
        // Retry if enabled
        if (this.config.retryAfterFailure && queuedEvent.retryCount < this.config.maxRetryAttempts) {
          queuedEvent.retryCount++;
          this.eventQueue.push(queuedEvent);
        }
      }
    }

    this.state.eventsInQueue = this.eventQueue.length;
  }

  // Process individual event
  private async processEvent(event: PusherEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.action);
    if (handler) {
      try {
        handler(event);
        console.log(`📨 Event processed: ${event.action}`, event.id);
      } catch (error) {
        console.error(`❌ Error processing event ${event.action}:`, error);
      }
    }
  }

  // Notify handlers
  private notifyHandlers(action: EventAction, event: PusherEvent): void {
    const handler = this.eventHandlers.get(action);
    if (handler) {
      try {
        handler(event);
      } catch (error) {
        console.error(`❌ Error notifying handler for ${action}:`, error);
      }
    }
  }

  // Register event handler
  registerHandler(action: EventAction, handler: (event: PusherEvent) => void): void {
    this.eventHandlers.set(action, handler);
  }

  // Unregister event handler
  unregisterHandler(action: EventAction): void {
    this.eventHandlers.delete(action);
  }

  // Store event in localStorage
  private storeEvent(event: PusherEvent): void {
    try {
      const storedEvents = this.getStoredEvents();
      storedEvents.push({
        ...event,
        storedAt: Date.now()
      });

      // Keep only recent events
      const cutoff = Date.now() - this.config.localStorageExpiry;
      const recentEvents = storedEvents.filter(e => e.storedAt > cutoff);

      localStorage.setItem(
        this.config.localStorageKey,
        JSON.stringify(recentEvents)
      );
    } catch (error) {
      console.error('❌ Failed to store event in localStorage:', error);
    }
  }

  // Get stored events from localStorage
  private getStoredEvents(): Array<PusherEvent & { storedAt: number }> {
    try {
      const stored = localStorage.getItem(this.config.localStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored events from localStorage:', error);
      return [];
    }
  }

  // Clear stored events
  private clearStoredEvents(): void {
    try {
      localStorage.removeItem(this.config.localStorageKey);
    } catch (error) {
      console.error('❌ Failed to clear stored events from localStorage:', error);
    }
  }

  // Load events from localStorage
  private async loadEventsFromStorage(): Promise<void> {
    try {
      const storedEvents = this.getStoredEvents();
      
      if (storedEvents.length > 0) {
        console.log(`💾 Loading ${storedEvents.length} events from localStorage`);
        
        for (const event of storedEvents) {
          await this.processEvent(event);
        }
        
        this.clearStoredEvents();
      }
    } catch (error) {
      console.error('❌ Failed to load events from localStorage:', error);
    }
  }

  // Get fallback state
  getState(): FallbackState {
    return { ...this.state };
  }

  // Get statistics
  getStatistics(): {
    state: FallbackState;
    queueLength: number;
    config: FallbackConfig;
  } {
    return {
      state: this.getState(),
      queueLength: this.eventQueue.length,
      config: this.config
    };
  }

  // Check if fallback is active
  isActive(): boolean {
    return this.state.isActive;
  }

  // Check if in fallback mode
  isInFallbackMode(): boolean {
    return this.state.mode !== 'pusher';
  }

  // Force retry
  async forceRetry(): Promise<void> {
    if (this.isDestroyed) return;

    console.log('🔄 Forcing fallback retry...');
    
    this.state.retryAttempts++;
    
    if (this.config.enablePolling) {
      await this.activatePollingMode();
    } else if (this.config.enableLocalStorage) {
      await this.activateLocalStorageMode();
    }
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;
    this.state.isActive = false;

    this.stopPolling();
    this.stopDegradationTimer();
    this.eventQueue = [];
    this.eventHandlers.clear();

    console.log('🧹 Fallback manager destroyed');
  }
}

// Singleton instance
let fallbackManager: FallbackManager | null = null;

// Get or create singleton instance
export const getFallbackManager = (config?: Partial<FallbackConfig>): FallbackManager => {
  if (!fallbackManager) {
    fallbackManager = new FallbackManager(config);
  }
  return fallbackManager;
};

// Cleanup function
export const cleanupFallbackManager = (): void => {
  if (fallbackManager) {
    fallbackManager.destroy();
    fallbackManager = null;
  }
};
