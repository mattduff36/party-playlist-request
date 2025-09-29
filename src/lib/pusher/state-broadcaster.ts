/**
 * State Broadcasting Utilities
 * 
 * This module provides utilities for broadcasting state changes
 * from the global state management system to all connected clients.
 */

import { broadcastEvent } from './broadcaster';
import { EventAction, PusherEvent } from './events';
import { getGlobalEventActions } from '@/lib/state/global-event-client';

// State change types
export type StateChangeType = 
  | 'event-status-change'
  | 'page-enablement-change'
  | 'event-config-change'
  | 'loading-state-change'
  | 'error-state-change'
  | 'user-action-change';

// State change payload
export interface StateChangePayload {
  type: StateChangeType;
  oldValue: any;
  newValue: any;
  timestamp: number;
  source: 'user' | 'system' | 'admin';
  metadata?: Record<string, any>;
}

// Broadcasting configuration
interface BroadcastingConfig {
  enableStateBroadcasting: boolean;
  enableUserActionBroadcasting: boolean;
  enableSystemEventBroadcasting: boolean;
  enableAdminActionBroadcasting: boolean;
  debounceDelay: number;
  batchSize: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: BroadcastingConfig = {
  enableStateBroadcasting: true,
  enableUserActionBroadcasting: true,
  enableSystemEventBroadcasting: true,
  enableAdminActionBroadcasting: true,
  debounceDelay: 100,
  batchSize: 10,
  maxRetries: 3
};

export class StateBroadcaster {
  private config: BroadcastingConfig;
  private eventId: string | null = null;
  private globalEventActions: ReturnType<typeof getGlobalEventActions> | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingBroadcasts: Map<string, StateChangePayload> = new Map();
  private isDestroyed = false;

  constructor(config: Partial<BroadcastingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Initialize the broadcaster
  async initialize(eventId: string): Promise<void> {
    this.eventId = eventId;
    this.globalEventActions = getGlobalEventActions();
    
    console.log('📡 State broadcaster initialized');
  }

  // Broadcast event status change
  async broadcastEventStatusChange(
    oldStatus: string,
    newStatus: string,
    source: 'user' | 'system' | 'admin' = 'system'
  ): Promise<void> {
    if (!this.config.enableStateBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'event-status-change',
      oldValue: oldStatus,
      newValue: newStatus,
      timestamp: Date.now(),
      source,
      metadata: {
        eventId: this.eventId
      }
    };

    await this.broadcastStateChange(payload, 'event-state-update');
  }

  // Broadcast page enablement change
  async broadcastPageEnablementChange(
    page: 'requests' | 'display',
    enabled: boolean,
    source: 'user' | 'system' | 'admin' = 'system'
  ): Promise<void> {
    if (!this.config.enableStateBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'page-enablement-change',
      oldValue: !enabled,
      newValue: enabled,
      timestamp: Date.now(),
      source,
      metadata: {
        page,
        eventId: this.eventId
      }
    };

    await this.broadcastStateChange(payload, 'page-control-toggle');
  }

  // Broadcast event config change
  async broadcastEventConfigChange(
    oldConfig: any,
    newConfig: any,
    source: 'user' | 'system' | 'admin' = 'system'
  ): Promise<void> {
    if (!this.config.enableStateBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'event-config-change',
      oldValue: oldConfig,
      newValue: newConfig,
      timestamp: Date.now(),
      source,
      metadata: {
        eventId: this.eventId
      }
    };

    await this.broadcastStateChange(payload, 'event-config-update');
  }

  // Broadcast loading state change
  async broadcastLoadingStateChange(
    isLoading: boolean,
    component?: string,
    source: 'user' | 'system' | 'admin' = 'system'
  ): Promise<void> {
    if (!this.config.enableStateBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'loading-state-change',
      oldValue: !isLoading,
      newValue: isLoading,
      timestamp: Date.now(),
      source,
      metadata: {
        component,
        eventId: this.eventId
      }
    };

    await this.broadcastStateChange(payload, 'message-update');
  }

  // Broadcast error state change
  async broadcastErrorStateChange(
    error: Error | null,
    component?: string,
    source: 'user' | 'system' | 'admin' = 'system'
  ): Promise<void> {
    if (!this.config.enableStateBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'error-state-change',
      oldValue: null,
      newValue: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : null,
      timestamp: Date.now(),
      source,
      metadata: {
        component,
        eventId: this.eventId
      }
    };

    await this.broadcastStateChange(payload, 'message-update');
  }

  // Broadcast user action
  async broadcastUserAction(
    action: string,
    data: any,
    source: 'user' | 'system' | 'admin' = 'user'
  ): Promise<void> {
    if (!this.config.enableUserActionBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'user-action-change',
      oldValue: null,
      newValue: data,
      timestamp: Date.now(),
      source,
      metadata: {
        action,
        eventId: this.eventId
      }
    };

    await this.broadcastStateChange(payload, 'message-update');
  }

  // Broadcast system event
  async broadcastSystemEvent(
    event: string,
    data: any,
    source: 'user' | 'system' | 'admin' = 'system'
  ): Promise<void> {
    if (!this.config.enableSystemEventBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'user-action-change', // Reuse this type for system events
      oldValue: null,
      newValue: data,
      timestamp: Date.now(),
      source,
      metadata: {
        action: event,
        eventId: this.eventId,
        isSystemEvent: true
      }
    };

    await this.broadcastStateChange(payload, 'message-update');
  }

  // Broadcast admin action
  async broadcastAdminAction(
    action: string,
    data: any,
    source: 'user' | 'system' | 'admin' = 'admin'
  ): Promise<void> {
    if (!this.config.enableAdminActionBroadcasting || !this.eventId) return;

    const payload: StateChangePayload = {
      type: 'user-action-change', // Reuse this type for admin actions
      oldValue: null,
      newValue: data,
      timestamp: Date.now(),
      source,
      metadata: {
        action,
        eventId: this.eventId,
        isAdminAction: true
      }
    };

    await this.broadcastStateChange(payload, 'admin-login');
  }

  // Core broadcasting method with debouncing
  private async broadcastStateChange(
    payload: StateChangePayload,
    pusherAction: EventAction
  ): Promise<void> {
    if (this.isDestroyed || !this.eventId) return;

    const key = `${payload.type}-${payload.source}`;
    
    // Store the latest payload for this key
    this.pendingBroadcasts.set(key, payload);

    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      await this.flushPendingBroadcast(key, pusherAction);
    }, this.config.debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  // Flush pending broadcast
  private async flushPendingBroadcast(
    key: string,
    pusherAction: EventAction
  ): Promise<void> {
    const payload = this.pendingBroadcasts.get(key);
    if (!payload || !this.eventId) return;

    try {
      await broadcastEvent(this.eventId, pusherAction, payload);
      this.pendingBroadcasts.delete(key);
      this.debounceTimers.delete(key);
      
      console.log(`📡 State change broadcasted: ${payload.type}`, payload.timestamp);
    } catch (error) {
      console.error('❌ Failed to broadcast state change:', error);
      
      // Retry logic could be added here
      this.pendingBroadcasts.delete(key);
      this.debounceTimers.delete(key);
    }
  }

  // Broadcast immediate (no debouncing)
  async broadcastImmediate(
    payload: StateChangePayload,
    pusherAction: EventAction
  ): Promise<void> {
    if (this.isDestroyed || !this.eventId) return;

    try {
      await broadcastEvent(this.eventId, pusherAction, payload);
      console.log(`📡 Immediate state change broadcasted: ${payload.type}`, payload.timestamp);
    } catch (error) {
      console.error('❌ Failed to broadcast immediate state change:', error);
    }
  }

  // Batch broadcast multiple changes
  async broadcastBatch(
    changes: Array<{ payload: StateChangePayload; pusherAction: EventAction }>
  ): Promise<void> {
    if (this.isDestroyed || !this.eventId || changes.length === 0) return;

    try {
      // Group by pusher action
      const grouped = changes.reduce((acc, change) => {
        const key = change.pusherAction;
        if (!acc[key]) acc[key] = [];
        acc[key].push(change.payload);
        return acc;
      }, {} as Record<EventAction, StateChangePayload[]>);

      // Broadcast each group
      for (const [pusherAction, payloads] of Object.entries(grouped)) {
        await broadcastEvent(this.eventId, pusherAction as EventAction, {
          type: 'batch-state-changes',
          changes: payloads,
          timestamp: Date.now(),
          count: payloads.length
        });
      }

      console.log(`📡 Batch broadcasted ${changes.length} state changes`);
    } catch (error) {
      console.error('❌ Failed to broadcast batch state changes:', error);
    }
  }

  // Get pending broadcasts
  getPendingBroadcasts(): Map<string, StateChangePayload> {
    return new Map(this.pendingBroadcasts);
  }

  // Clear pending broadcasts
  clearPendingBroadcasts(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    
    this.debounceTimers.clear();
    this.pendingBroadcasts.clear();
    
    console.log('🧹 Pending broadcasts cleared');
  }

  // Update configuration
  updateConfig(newConfig: Partial<BroadcastingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Broadcasting configuration updated');
  }

  // Get statistics
  getStatistics(): {
    config: BroadcastingConfig;
    pendingCount: number;
    eventId: string | null;
    isDestroyed: boolean;
  } {
    return {
      config: this.config,
      pendingCount: this.pendingBroadcasts.size,
      eventId: this.eventId,
      isDestroyed: this.isDestroyed
    };
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;
    this.clearPendingBroadcasts();
    this.eventId = null;
    this.globalEventActions = null;
    
    console.log('🧹 State broadcaster destroyed');
  }
}

// Singleton instance
let stateBroadcaster: StateBroadcaster | null = null;

// Get or create singleton instance
export const getStateBroadcaster = (config?: Partial<BroadcastingConfig>): StateBroadcaster => {
  if (!stateBroadcaster) {
    stateBroadcaster = new StateBroadcaster(config);
  }
  return stateBroadcaster;
};

// Cleanup function
export const cleanupStateBroadcaster = (): void => {
  if (stateBroadcaster) {
    stateBroadcaster.destroy();
    stateBroadcaster = null;
  }
};
