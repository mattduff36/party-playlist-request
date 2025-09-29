import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { events, type Event, type EventStatus, type EventConfig } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { GlobalEventState } from './global-event.tsx';
import { OptimisticUpdateManager, type OptimisticUpdate } from './optimistic-updates';

/**
 * Automatic State Recovery Mechanisms
 * 
 * This module provides automatic recovery mechanisms for the global event state,
 * including connection recovery, data synchronization, and conflict resolution.
 */

export interface RecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  backoffMultiplier: number;
  healthCheckInterval: number;
  syncInterval: number;
  conflictResolutionStrategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
}

export interface RecoveryState {
  isRecovering: boolean;
  lastRecoveryAttempt: Date | null;
  recoveryCount: number;
  lastError: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  syncStatus: 'synced' | 'syncing' | 'conflict' | 'error';
}

export interface HealthCheck {
  database: boolean;
  connection: boolean;
  sync: boolean;
  lastCheck: Date;
  errors: string[];
}

export class StateRecoveryManager {
  private config: RecoveryConfig;
  private updateManager: OptimisticUpdateManager;
  private recoveryState: RecoveryState;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(state: RecoveryState) => void> = new Set();

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = {
      maxRetries: 5,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      backoffMultiplier: 2,
      healthCheckInterval: 30000, // 30 seconds
      syncInterval: 10000, // 10 seconds
      conflictResolutionStrategy: 'server-wins',
      ...config,
    };

    this.updateManager = new OptimisticUpdateManager();
    this.recoveryState = {
      isRecovering: false,
      lastRecoveryAttempt: null,
      recoveryCount: 0,
      lastError: null,
      connectionStatus: 'disconnected',
      syncStatus: 'synced',
    };
  }

  /**
   * Start recovery mechanisms
   */
  start(): void {
    this.startHealthChecks();
    this.startPeriodicSync();
  }

  /**
   * Stop recovery mechanisms
   */
  stop(): void {
    this.stopHealthChecks();
    this.stopPeriodicSync();
    this.clearRetryTimeout();
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, this.config.syncInterval);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const healthCheck: HealthCheck = {
      database: false,
      connection: false,
      sync: false,
      lastCheck: new Date(),
      errors: [],
    };

    try {
      // Check database connection
      await db.execute('SELECT 1');
      healthCheck.database = true;
    } catch (error) {
      healthCheck.errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Check connection status
      healthCheck.connection = navigator.onLine;
      if (!healthCheck.connection) {
        healthCheck.errors.push('Network connection lost');
      }
    } catch (error) {
      healthCheck.errors.push(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Check sync status
      const pendingUpdates = this.updateManager.getPendingUpdates();
      healthCheck.sync = pendingUpdates.length === 0;
      if (!healthCheck.sync) {
        healthCheck.errors.push(`${pendingUpdates.length} pending updates`);
      }
    } catch (error) {
      healthCheck.errors.push(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Update recovery state based on health check
    this.updateRecoveryState({
      connectionStatus: healthCheck.connection ? 'connected' : 'disconnected',
      syncStatus: healthCheck.sync ? 'synced' : 'syncing',
    });

    return healthCheck;
  }

  /**
   * Perform data synchronization
   */
  async performSync(): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateRecoveryState({ syncStatus: 'syncing' });

      // Get current server state
      const serverEvent = await this.getServerState();
      if (!serverEvent) {
        throw new Error('No server state found');
      }

      // Check for conflicts with pending updates
      const pendingUpdates = this.updateManager.getPendingUpdates();
      const conflicts = this.detectConflicts(serverEvent, pendingUpdates);

      if (conflicts.length > 0) {
        this.updateRecoveryState({ syncStatus: 'conflict' });
        await this.resolveConflicts(conflicts, serverEvent);
      }

      // Apply pending updates
      for (const update of pendingUpdates) {
        await this.updateManager.applyToDatabase(update);
      }

      this.updateRecoveryState({ syncStatus: 'synced' });
      return { success: true };
    } catch (error) {
      this.updateRecoveryState({ 
        syncStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current server state
   */
  private async getServerState(): Promise<Event | null> {
    try {
      const results = await db.select().from(events).limit(1);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      throw new Error(`Failed to get server state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect conflicts between server state and pending updates
   */
  private detectConflicts(serverEvent: Event, pendingUpdates: OptimisticUpdate[]): OptimisticUpdate[] {
    return pendingUpdates.filter(update => {
      // Check if server version is ahead of update version
      return serverEvent.version > update.version;
    });
  }

  /**
   * Resolve conflicts
   */
  private async resolveConflicts(conflicts: OptimisticUpdate[], serverEvent: Event): Promise<void> {
    for (const conflict of conflicts) {
      const resolution = this.resolveConflict(conflict, serverEvent);
      
      switch (resolution.strategy) {
        case 'server-wins':
          // Remove the conflicting update
          this.updateManager.removeUpdate(conflict.id);
          break;
        case 'client-wins':
          // Force apply the update (increment server version)
          await this.forceApplyUpdate(conflict, serverEvent);
          break;
        case 'merge':
          // Merge the update with server state
          await this.mergeUpdate(conflict, serverEvent);
          break;
        case 'manual':
          // Mark for manual resolution
          conflict.status = 'conflict';
          break;
      }
    }
  }

  /**
   * Resolve individual conflict
   */
  private resolveConflict(conflict: OptimisticUpdate, serverEvent: Event): { strategy: string; resolution?: any } {
    // Default to server-wins for most conflicts
    return { strategy: this.config.conflictResolutionStrategy };
  }

  /**
   * Force apply update (client-wins strategy)
   */
  private async forceApplyUpdate(update: OptimisticUpdate, serverEvent: Event): Promise<void> {
    // This would require custom database operations to force the update
    // Implementation depends on specific database constraints
    throw new Error('Force apply not implemented');
  }

  /**
   * Merge update with server state
   */
  private async mergeUpdate(update: OptimisticUpdate, serverEvent: Event): Promise<void> {
    // This would require intelligent merging logic
    // Implementation depends on the specific update type
    throw new Error('Merge update not implemented');
  }

  /**
   * Attempt recovery
   */
  async attemptRecovery(): Promise<{ success: boolean; error?: string }> {
    if (this.recoveryState.isRecovering) {
      return { success: false, error: 'Recovery already in progress' };
    }

    this.updateRecoveryState({
      isRecovering: true,
      lastRecoveryAttempt: new Date(),
      recoveryCount: this.recoveryState.recoveryCount + 1,
    });

    try {
      // Perform health check
      const healthCheck = await this.performHealthCheck();
      
      if (!healthCheck.database) {
        throw new Error('Database connection failed');
      }

      if (!healthCheck.connection) {
        throw new Error('Network connection failed');
      }

      // Perform sync
      const syncResult = await this.performSync();
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Sync failed');
      }

      this.updateRecoveryState({
        isRecovering: false,
        lastError: null,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.updateRecoveryState({
        isRecovering: false,
        lastError: errorMessage,
      });

      // Schedule retry if under max retries
      if (this.recoveryState.recoveryCount < this.config.maxRetries) {
        this.scheduleRetry();
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Schedule retry
   */
  private scheduleRetry(): void {
    const delay = Math.min(
      this.config.retryDelay * Math.pow(this.config.backoffMultiplier, this.recoveryState.recoveryCount),
      this.config.maxRetryDelay
    );

    this.retryTimeout = setTimeout(() => {
      this.attemptRecovery();
    }, delay);
  }

  /**
   * Clear retry timeout
   */
  private clearRetryTimeout(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  /**
   * Update recovery state
   */
  private updateRecoveryState(updates: Partial<RecoveryState>): void {
    this.recoveryState = { ...this.recoveryState, ...updates };
    this.notifyListeners();
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.recoveryState));
  }

  /**
   * Add listener
   */
  addListener(listener: (state: RecoveryState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get recovery state
   */
  getRecoveryState(): RecoveryState {
    return { ...this.recoveryState };
  }

  /**
   * Get update manager
   */
  getUpdateManager(): OptimisticUpdateManager {
    return this.updateManager;
  }
}

/**
 * Hook for state recovery
 */
export function useStateRecovery(config: Partial<RecoveryConfig> = {}) {
  const [recoveryManager] = useState(() => new StateRecoveryManager(config));
  const [recoveryState, setRecoveryState] = useState<RecoveryState>(recoveryManager.getRecoveryState());
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);

  // Update recovery state when it changes
  useEffect(() => {
    const unsubscribe = recoveryManager.addListener(setRecoveryState);
    return unsubscribe;
  }, [recoveryManager]);

  // Start recovery mechanisms on mount
  useEffect(() => {
    recoveryManager.start();
    return () => recoveryManager.stop();
  }, [recoveryManager]);

  // Perform health check
  const performHealthCheck = useCallback(async () => {
    const result = await recoveryManager.performHealthCheck();
    setHealthCheck(result);
    return result;
  }, [recoveryManager]);

  // Attempt recovery
  const attemptRecovery = useCallback(async () => {
    return await recoveryManager.attemptRecovery();
  }, [recoveryManager]);

  // Perform sync
  const performSync = useCallback(async () => {
    return await recoveryManager.performSync();
  }, [recoveryManager]);

  // Get update manager
  const getUpdateManager = useCallback(() => {
    return recoveryManager.getUpdateManager();
  }, [recoveryManager]);

  return {
    recoveryState,
    healthCheck,
    performHealthCheck,
    attemptRecovery,
    performSync,
    getUpdateManager,
  };
}

export type { RecoveryConfig, RecoveryState, HealthCheck };
