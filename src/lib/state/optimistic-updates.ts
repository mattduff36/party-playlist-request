import { useCallback, useRef, useState } from 'react';
import { db } from '../db';
import { events, type Event, type EventStatus, type EventConfig } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { GlobalEventState } from './global-event';

/**
 * Optimistic Update System with Version Control
 * 
 * This module provides optimistic updates for the global event state,
 * ensuring immediate UI feedback while maintaining data consistency
 * through version control and conflict resolution.
 */

export interface OptimisticUpdate {
  id: string;
  type: 'status' | 'config' | 'admin' | 'pages';
  payload: any;
  timestamp: number;
  version: number;
  status: 'pending' | 'applying' | 'applied' | 'failed' | 'conflict';
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  resolution?: any;
}

export class OptimisticUpdateManager {
  private updates: Map<string, OptimisticUpdate> = new Map();
  private version: number = 0;
  private conflictHandlers: Map<string, (conflict: OptimisticUpdate) => ConflictResolution> = new Map();

  constructor(initialVersion: number = 0) {
    this.version = initialVersion;
  }

  /**
   * Create a new optimistic update
   */
  createUpdate(
    type: OptimisticUpdate['type'],
    payload: any,
    maxRetries: number = 3
  ): OptimisticUpdate {
    const id = `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const update: OptimisticUpdate = {
      id,
      type,
      payload,
      timestamp: Date.now(),
      version: this.version + 1,
      status: 'pending',
      retryCount: 0,
      maxRetries,
    };

    this.updates.set(id, update);
    this.version += 1;
    return update;
  }

  /**
   * Apply an optimistic update to local state
   */
  applyOptimisticUpdate(
    currentState: GlobalEventState,
    update: OptimisticUpdate
  ): GlobalEventState {
    const newState = { ...currentState };

    switch (update.type) {
      case 'status':
        newState.status = update.payload.status;
        newState.version = update.version;
        break;
      case 'config':
        newState.config = { ...newState.config, ...update.payload };
        newState.version = update.version;
        break;
      case 'admin':
        newState.activeAdminId = update.payload.adminId;
        newState.adminName = update.payload.adminName;
        newState.version = update.version;
        break;
      case 'pages':
        newState.pagesEnabled = { ...newState.pagesEnabled, ...update.payload };
        newState.config.pages_enabled = { ...newState.config.pages_enabled, ...update.payload };
        newState.version = update.version;
        break;
    }

    newState.lastUpdated = new Date();
    return newState;
  }

  /**
   * Apply optimistic update to database
   */
  async applyToDatabase(update: OptimisticUpdate): Promise<{ success: boolean; error?: string; serverVersion?: number }> {
    try {
      update.status = 'applying';

      // Get current server state
      const currentEventResults = await db.select().from(events).limit(1);
      if (currentEventResults.length === 0) {
        throw new Error('No event found');
      }

      const currentEvent = currentEventResults[0];
      const serverVersion = currentEvent.version;

      // Check for version conflicts
      if (serverVersion > update.version) {
        update.status = 'conflict';
        return { success: false, error: 'Version conflict detected', serverVersion };
      }

      // Apply update based on type
      let updatedEvent: Event;
      switch (update.type) {
        case 'status':
          updatedEvent = await this.applyStatusUpdate(currentEvent, update.payload);
          break;
        case 'config':
          updatedEvent = await this.applyConfigUpdate(currentEvent, update.payload);
          break;
        case 'admin':
          updatedEvent = await this.applyAdminUpdate(currentEvent, update.payload);
          break;
        case 'pages':
          updatedEvent = await this.applyPagesUpdate(currentEvent, update.payload);
          break;
        default:
          throw new Error(`Unknown update type: ${update.type}`);
      }

      update.status = 'applied';
      return { success: true, serverVersion: updatedEvent.version };
    } catch (error) {
      update.status = 'failed';
      update.error = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: update.error };
    }
  }

  /**
   * Apply status update to database
   */
  private async applyStatusUpdate(currentEvent: Event, payload: { status: EventStatus }): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        status: payload.status,
        version: currentEvent.version + 1,
        updated_at: new Date(),
      })
      .where(eq(events.id, currentEvent.id))
      .returning();

    return updatedEvent;
  }

  /**
   * Apply config update to database
   */
  private async applyConfigUpdate(currentEvent: Event, payload: Partial<EventConfig>): Promise<Event> {
    const newConfig = { ...currentEvent.config as EventConfig, ...payload };
    
    const [updatedEvent] = await db
      .update(events)
      .set({
        config: newConfig,
        version: currentEvent.version + 1,
        updated_at: new Date(),
      })
      .where(eq(events.id, currentEvent.id))
      .returning();

    return updatedEvent;
  }

  /**
   * Apply admin update to database
   */
  private async applyAdminUpdate(currentEvent: Event, payload: { adminId: string; adminName: string }): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        active_admin_id: payload.adminId,
        version: currentEvent.version + 1,
        updated_at: new Date(),
      })
      .where(eq(events.id, currentEvent.id))
      .returning();

    return updatedEvent;
  }

  /**
   * Apply pages update to database
   */
  private async applyPagesUpdate(currentEvent: Event, payload: { requests?: boolean; display?: boolean }): Promise<Event> {
    const currentConfig = currentEvent.config as EventConfig;
    const newConfig = {
      ...currentConfig,
      pages_enabled: {
        ...currentConfig.pages_enabled,
        ...payload,
      },
    };

    const [updatedEvent] = await db
      .update(events)
      .set({
        config: newConfig,
        version: currentEvent.version + 1,
        updated_at: new Date(),
      })
      .where(eq(events.id, currentEvent.id))
      .returning();

    return updatedEvent;
  }

  /**
   * Resolve conflicts
   */
  resolveConflict(update: OptimisticUpdate, serverState: GlobalEventState): ConflictResolution {
    const handler = this.conflictHandlers.get(update.type);
    if (handler) {
      return handler(update);
    }

    // Default conflict resolution strategy
    return {
      strategy: 'server-wins',
    };
  }

  /**
   * Register conflict handler
   */
  registerConflictHandler(type: OptimisticUpdate['type'], handler: (conflict: OptimisticUpdate) => ConflictResolution) {
    this.conflictHandlers.set(type, handler);
  }

  /**
   * Get pending updates
   */
  getPendingUpdates(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(update => 
      update.status === 'pending' || update.status === 'applying'
    );
  }

  /**
   * Get failed updates
   */
  getFailedUpdates(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(update => update.status === 'failed');
  }

  /**
   * Retry failed update
   */
  async retryUpdate(updateId: string): Promise<{ success: boolean; error?: string }> {
    const update = this.updates.get(updateId);
    if (!update) {
      return { success: false, error: 'Update not found' };
    }

    if (update.retryCount >= update.maxRetries) {
      return { success: false, error: 'Max retries exceeded' };
    }

    update.retryCount += 1;
    update.status = 'pending';
    update.error = undefined;

    return await this.applyToDatabase(update);
  }

  /**
   * Remove completed update
   */
  removeUpdate(updateId: string): boolean {
    return this.updates.delete(updateId);
  }

  /**
   * Clear all updates
   */
  clearUpdates(): void {
    this.updates.clear();
  }

  /**
   * Get update by ID
   */
  getUpdate(updateId: string): OptimisticUpdate | undefined {
    return this.updates.get(updateId);
  }

  /**
   * Get current version
   */
  getCurrentVersion(): number {
    return this.version;
  }
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdates() {
  const [updateManager] = useState(() => new OptimisticUpdateManager());
  const [updates, setUpdates] = useState<OptimisticUpdate[]>([]);

  // Update local state when updates change
  const refreshUpdates = useCallback(() => {
    setUpdates(Array.from(updateManager.updates.values()));
  }, [updateManager]);

  // Create optimistic update
  const createUpdate = useCallback((
    type: OptimisticUpdate['type'],
    payload: any,
    maxRetries: number = 3
  ): OptimisticUpdate => {
    const update = updateManager.createUpdate(type, payload, maxRetries);
    refreshUpdates();
    return update;
  }, [updateManager, refreshUpdates]);

  // Apply optimistic update
  const applyUpdate = useCallback(async (update: OptimisticUpdate): Promise<{ success: boolean; error?: string }> => {
    const result = await updateManager.applyToDatabase(update);
    refreshUpdates();
    return result;
  }, [updateManager, refreshUpdates]);

  // Retry failed update
  const retryUpdate = useCallback(async (updateId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await updateManager.retryUpdate(updateId);
    refreshUpdates();
    return result;
  }, [updateManager, refreshUpdates]);

  // Remove update
  const removeUpdate = useCallback((updateId: string): boolean => {
    const result = updateManager.removeUpdate(updateId);
    refreshUpdates();
    return result;
  }, [updateManager, refreshUpdates]);

  // Get pending updates
  const getPendingUpdates = useCallback((): OptimisticUpdate[] => {
    return updateManager.getPendingUpdates();
  }, [updateManager]);

  // Get failed updates
  const getFailedUpdates = useCallback((): OptimisticUpdate[] => {
    return updateManager.getFailedUpdates();
  }, [updateManager]);

  // Register conflict handler
  const registerConflictHandler = useCallback((
    type: OptimisticUpdate['type'],
    handler: (conflict: OptimisticUpdate) => ConflictResolution
  ) => {
    updateManager.registerConflictHandler(type, handler);
  }, [updateManager]);

  return {
    updates,
    createUpdate,
    applyUpdate,
    retryUpdate,
    removeUpdate,
    getPendingUpdates,
    getFailedUpdates,
    registerConflictHandler,
    refreshUpdates,
  };
}

/**
 * Hook for optimistic state updates
 */
export function useOptimisticState<T>(
  initialState: T,
  updateFn: (state: T, update: OptimisticUpdate) => T
) {
  const [state, setState] = useState<T>(initialState);
  const { updates, createUpdate, applyUpdate } = useOptimisticUpdates();

  // Apply optimistic updates to state
  const applyOptimisticState = useCallback((update: OptimisticUpdate) => {
    setState(prevState => updateFn(prevState, update));
  }, [updateFn]);

  // Create and apply optimistic update
  const createAndApplyUpdate = useCallback(async (
    type: OptimisticUpdate['type'],
    payload: any,
    maxRetries: number = 3
  ) => {
    const update = createUpdate(type, payload, maxRetries);
    applyOptimisticState(update);
    
    const result = await applyUpdate(update);
    if (!result.success) {
      // Revert optimistic state on failure
      setState(initialState);
    }
    
    return { update, result };
  }, [createUpdate, applyOptimisticState, applyUpdate, initialState]);

  return {
    state,
    setState,
    updates,
    createAndApplyUpdate,
    applyOptimisticState,
  };
}

export type { OptimisticUpdate, ConflictResolution };
