/**
 * Event Deduplication and Ordering System
 * 
 * This module provides robust event deduplication and ordering mechanisms
 * to ensure reliable real-time synchronization across all devices.
 */

import { 
  PusherEvent, 
  EventId, 
  EventTimestamp, 
  EventVersion,
  getEventDeduplicationKey,
  compareEvents
} from './events';

// Deduplication configuration
interface DeduplicationConfig {
  maxProcessedEvents: number;
  maxPendingEvents: number;
  deduplicationWindow: number; // milliseconds
  orderingWindow: number; // milliseconds
  cleanupInterval: number; // milliseconds
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  maxProcessedEvents: 10000,
  maxPendingEvents: 1000,
  deduplicationWindow: 300000, // 5 minutes
  orderingWindow: 10000, // 10 seconds
  cleanupInterval: 60000 // 1 minute
};

// Event store entry
interface EventStoreEntry {
  event: PusherEvent;
  processedAt: number;
  order: number;
}

// Pending event entry
interface PendingEventEntry {
  event: PusherEvent;
  receivedAt: number;
  retryCount: number;
  maxRetries: number;
}

// Event ordering queue
interface OrderingQueue {
  events: Map<EventId, PendingEventEntry>;
  nextOrder: number;
  lastProcessedTimestamp: EventTimestamp;
}

export class EventDeduplicationManager {
  private config: DeduplicationConfig;
  private processedEvents: Map<string, EventStoreEntry> = new Map();
  private pendingEvents: Map<EventId, PendingEventEntry> = new Map();
  private orderingQueues: Map<string, OrderingQueue> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, (event: PusherEvent) => void> = new Map();
  private statistics = {
    totalProcessed: 0,
    totalDeduplicated: 0,
    totalOrdered: 0,
    totalErrors: 0,
    lastCleanup: Date.now()
  };

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  // Process incoming event
  async processEvent(event: PusherEvent): Promise<boolean> {
    try {
      // Check if event is valid
      if (!this.isValidEvent(event)) {
        console.warn('⚠️ Invalid event received:', event);
        this.statistics.totalErrors++;
        return false;
      }

      // Check for duplicates
      const dedupKey = getEventDeduplicationKey(event);
      if (this.isDuplicate(dedupKey)) {
        console.log('🔄 Duplicate event ignored:', event.id);
        this.statistics.totalDeduplicated++;
        return false;
      }

      // Add to processed events
      this.addToProcessedEvents(dedupKey, event);

      // Check if event should be ordered
      if (this.shouldOrderEvent(event)) {
        return this.processOrderedEvent(event);
      } else {
        return this.processImmediateEvent(event);
      }

    } catch (error) {
      console.error('❌ Error processing event:', error, event);
      this.statistics.totalErrors++;
      return false;
    }
  }

  // Check if event is valid
  private isValidEvent(event: any): event is PusherEvent {
    return (
      event &&
      typeof event.id === 'string' &&
      typeof event.timestamp === 'number' &&
      typeof event.version === 'number' &&
      typeof event.eventId === 'string' &&
      typeof event.action === 'string' &&
      event.data !== undefined
    );
  }

  // Check if event is duplicate
  private isDuplicate(dedupKey: string): boolean {
    return this.processedEvents.has(dedupKey);
  }

  // Add event to processed events
  private addToProcessedEvents(dedupKey: string, event: PusherEvent): void {
    const entry: EventStoreEntry = {
      event,
      processedAt: Date.now(),
      order: this.statistics.totalProcessed
    };

    this.processedEvents.set(dedupKey, entry);
    this.statistics.totalProcessed++;

    // Cleanup if we exceed max processed events
    if (this.processedEvents.size > this.config.maxProcessedEvents) {
      this.cleanupProcessedEvents();
    }
  }

  // Check if event should be ordered
  private shouldOrderEvent(event: PusherEvent): boolean {
    // Some events need strict ordering (e.g., state updates, request approvals)
    const orderedActions = [
      'state_update',
      'request_approved',
      'request_rejected',
      'page_control_toggle',
      'admin_login',
      'admin_logout'
    ];

    return orderedActions.includes(event.action);
  }

  // Process event with ordering
  private processOrderedEvent(event: PusherEvent): boolean {
    const queueKey = `${event.eventId}-${event.action}`;
    
    // Get or create ordering queue
    if (!this.orderingQueues.has(queueKey)) {
      this.orderingQueues.set(queueKey, {
        events: new Map(),
        nextOrder: 0,
        lastProcessedTimestamp: 0
      });
    }

    const queue = this.orderingQueues.get(queueKey)!;
    
    // Add event to pending queue
    const pendingEntry: PendingEventEntry = {
      event,
      receivedAt: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    this.pendingEvents.set(event.id, pendingEntry);
    queue.events.set(event.id, pendingEntry);

    // Process events in order
    this.processOrderingQueue(queueKey);

    return true;
  }

  // Process immediate event
  private processImmediateEvent(event: PusherEvent): boolean {
    this.deliverEvent(event);
    return true;
  }

  // Process ordering queue
  private processOrderingQueue(queueKey: string): void {
    const queue = this.orderingQueues.get(queueKey);
    if (!queue) return;

    // Sort events by timestamp and version
    const sortedEvents = Array.from(queue.events.values())
      .sort((a, b) => compareEvents(a.event, b.event));

    // Process events in order
    for (const entry of sortedEvents) {
      // Check if event is ready to be processed
      if (this.isEventReady(entry.event, queue)) {
        this.deliverEvent(entry.event);
        queue.events.delete(entry.event.id);
        this.pendingEvents.delete(entry.event.id);
        queue.lastProcessedTimestamp = entry.event.timestamp;
        this.statistics.totalOrdered++;
      }
    }

    // Cleanup empty queues
    if (queue.events.size === 0) {
      this.orderingQueues.delete(queueKey);
    }
  }

  // Check if event is ready to be processed
  private isEventReady(event: PusherEvent, queue: OrderingQueue): boolean {
    const now = Date.now();
    const eventAge = now - event.timestamp;
    
    // Event is ready if:
    // 1. It's newer than the last processed event in this queue
    // 2. It's within the ordering window
    // 3. It's not too old
    return (
      event.timestamp > queue.lastProcessedTimestamp &&
      eventAge <= this.config.orderingWindow &&
      eventAge >= 0
    );
  }

  // Deliver event to handlers
  private deliverEvent(event: PusherEvent): void {
    const handler = this.eventHandlers.get(event.action);
    if (handler) {
      try {
        handler(event);
        console.log(`📨 Event delivered: ${event.action}`, event.id);
      } catch (error) {
        console.error(`❌ Error delivering event ${event.action}:`, error);
        this.statistics.totalErrors++;
      }
    } else {
      console.log(`📨 No handler for event: ${event.action}`);
    }
  }

  // Register event handler
  registerHandler(action: string, handler: (event: PusherEvent) => void): void {
    this.eventHandlers.set(action, handler);
  }

  // Unregister event handler
  unregisterHandler(action: string): void {
    this.eventHandlers.delete(action);
  }

  // Get statistics
  getStatistics(): typeof this.statistics {
    return { ...this.statistics };
  }

  // Get detailed statistics
  getDetailedStatistics(): {
    processed: number;
    pending: number;
    orderingQueues: number;
    handlers: number;
    memoryUsage: {
      processedEvents: number;
      pendingEvents: number;
      orderingQueues: number;
    };
  } {
    return {
      processed: this.processedEvents.size,
      pending: this.pendingEvents.size,
      orderingQueues: this.orderingQueues.size,
      handlers: this.eventHandlers.size,
      memoryUsage: {
        processedEvents: this.processedEvents.size,
        pendingEvents: this.pendingEvents.size,
        orderingQueues: this.orderingQueues.size
      }
    };
  }

  // Cleanup processed events
  private cleanupProcessedEvents(): void {
    const now = Date.now();
    const cutoff = now - this.config.deduplicationWindow;

    // Remove old processed events
    for (const [key, entry] of this.processedEvents.entries()) {
      if (entry.processedAt < cutoff) {
        this.processedEvents.delete(key);
      }
    }

    // Remove old pending events
    for (const [id, entry] of this.pendingEvents.entries()) {
      if (entry.receivedAt < cutoff) {
        this.pendingEvents.delete(id);
      }
    }

    // Remove old ordering queues
    for (const [key, queue] of this.orderingQueues.entries()) {
      if (queue.events.size === 0) {
        this.orderingQueues.delete(key);
      }
    }

    this.statistics.lastCleanup = now;
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupProcessedEvents();
    }, this.config.cleanupInterval);
  }

  // Stop cleanup timer
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Cleanup all data
  cleanup(): void {
    this.stopCleanupTimer();
    this.processedEvents.clear();
    this.pendingEvents.clear();
    this.orderingQueues.clear();
    this.eventHandlers.clear();
    this.statistics = {
      totalProcessed: 0,
      totalDeduplicated: 0,
      totalOrdered: 0,
      totalErrors: 0,
      lastCleanup: Date.now()
    };
  }
}

// Singleton instance
let deduplicationManager: EventDeduplicationManager | null = null;

// Get or create singleton instance
export const getDeduplicationManager = (config?: Partial<DeduplicationConfig>): EventDeduplicationManager => {
  if (!deduplicationManager) {
    deduplicationManager = new EventDeduplicationManager(config);
  }
  return deduplicationManager;
};

// Cleanup function
export const cleanupDeduplicationManager = (): void => {
  if (deduplicationManager) {
    deduplicationManager.cleanup();
    deduplicationManager = null;
  }
};
