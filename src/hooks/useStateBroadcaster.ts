/**
 * React Hook for State Broadcasting
 * 
 * This hook provides a simple interface for components to broadcast
 * state changes through the centralized state broadcaster.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { 
  getStateBroadcaster, 
  StateBroadcaster, 
  StateChangePayload,
  StateChangeType 
} from '@/lib/pusher/state-broadcaster';
import { EventAction } from '@/lib/pusher/events';

interface UseStateBroadcasterOptions {
  eventId: string;
  enableBroadcasting?: boolean;
  debounceDelay?: number;
  onBroadcastSuccess?: (payload: StateChangePayload) => void;
  onBroadcastError?: (error: Error, payload: StateChangePayload) => void;
}

export const useStateBroadcaster = ({
  eventId,
  enableBroadcasting = true,
  debounceDelay,
  onBroadcastSuccess,
  onBroadcastError
}: UseStateBroadcasterOptions) => {
  const broadcaster = useRef<StateBroadcaster | null>(null);
  const isInitialized = useRef(false);

  // Initialize broadcaster
  useEffect(() => {
    if (!eventId || !enableBroadcasting || isInitialized.current) return;

    const initBroadcaster = async () => {
      try {
        broadcaster.current = getStateBroadcaster({
          enableStateBroadcasting: enableBroadcasting,
          debounceDelay
        });
        
        await broadcaster.current.initialize(eventId);
        isInitialized.current = true;
        
        console.log('✅ State broadcaster hook initialized');
      } catch (error) {
        console.error('❌ Failed to initialize state broadcaster hook:', error);
      }
    };

    initBroadcaster();

    return () => {
      if (broadcaster.current) {
        broadcaster.current.destroy();
        broadcaster.current = null;
        isInitialized.current = false;
      }
    };
  }, [eventId, enableBroadcasting, debounceDelay]);

  // Broadcast event status change
  const broadcastEventStatusChange = useCallback(async (
    oldStatus: string,
    newStatus: string,
    source: 'user' | 'system' | 'admin' = 'system'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastEventStatusChange(oldStatus, newStatus, source);
      onBroadcastSuccess?.({
        type: 'event-status-change',
        oldValue: oldStatus,
        newValue: newStatus,
        timestamp: Date.now(),
        source
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'event-status-change',
        oldValue: oldStatus,
        newValue: newStatus,
        timestamp: Date.now(),
        source
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast page enablement change
  const broadcastPageEnablementChange = useCallback(async (
    page: 'requests' | 'display',
    enabled: boolean,
    source: 'user' | 'system' | 'admin' = 'system'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastPageEnablementChange(page, enabled, source);
      onBroadcastSuccess?.({
        type: 'page-enablement-change',
        oldValue: !enabled,
        newValue: enabled,
        timestamp: Date.now(),
        source,
        metadata: { page }
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'page-enablement-change',
        oldValue: !enabled,
        newValue: enabled,
        timestamp: Date.now(),
        source,
        metadata: { page }
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast event config change
  const broadcastEventConfigChange = useCallback(async (
    oldConfig: any,
    newConfig: any,
    source: 'user' | 'system' | 'admin' = 'system'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastEventConfigChange(oldConfig, newConfig, source);
      onBroadcastSuccess?.({
        type: 'event-config-change',
        oldValue: oldConfig,
        newValue: newConfig,
        timestamp: Date.now(),
        source
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'event-config-change',
        oldValue: oldConfig,
        newValue: newConfig,
        timestamp: Date.now(),
        source
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast loading state change
  const broadcastLoadingStateChange = useCallback(async (
    isLoading: boolean,
    component?: string,
    source: 'user' | 'system' | 'admin' = 'system'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastLoadingStateChange(isLoading, component, source);
      onBroadcastSuccess?.({
        type: 'loading-state-change',
        oldValue: !isLoading,
        newValue: isLoading,
        timestamp: Date.now(),
        source,
        metadata: { component }
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'loading-state-change',
        oldValue: !isLoading,
        newValue: isLoading,
        timestamp: Date.now(),
        source,
        metadata: { component }
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast error state change
  const broadcastErrorStateChange = useCallback(async (
    error: Error | null,
    component?: string,
    source: 'user' | 'system' | 'admin' = 'system'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastErrorStateChange(error, component, source);
      onBroadcastSuccess?.({
        type: 'error-state-change',
        oldValue: null,
        newValue: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : null,
        timestamp: Date.now(),
        source,
        metadata: { component }
      });
    } catch (broadcastError) {
      onBroadcastError?.(broadcastError as Error, {
        type: 'error-state-change',
        oldValue: null,
        newValue: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : null,
        timestamp: Date.now(),
        source,
        metadata: { component }
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast user action
  const broadcastUserAction = useCallback(async (
    action: string,
    data: any,
    source: 'user' | 'system' | 'admin' = 'user'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastUserAction(action, data, source);
      onBroadcastSuccess?.({
        type: 'user-action-change',
        oldValue: null,
        newValue: data,
        timestamp: Date.now(),
        source,
        metadata: { action }
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'user-action-change',
        oldValue: null,
        newValue: data,
        timestamp: Date.now(),
        source,
        metadata: { action }
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast system event
  const broadcastSystemEvent = useCallback(async (
    event: string,
    data: any,
    source: 'user' | 'system' | 'admin' = 'system'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastSystemEvent(event, data, source);
      onBroadcastSuccess?.({
        type: 'user-action-change',
        oldValue: null,
        newValue: data,
        timestamp: Date.now(),
        source,
        metadata: { action: event, isSystemEvent: true }
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'user-action-change',
        oldValue: null,
        newValue: data,
        timestamp: Date.now(),
        source,
        metadata: { action: event, isSystemEvent: true }
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast admin action
  const broadcastAdminAction = useCallback(async (
    action: string,
    data: any,
    source: 'user' | 'system' | 'admin' = 'admin'
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastAdminAction(action, data, source);
      onBroadcastSuccess?.({
        type: 'user-action-change',
        oldValue: null,
        newValue: data,
        timestamp: Date.now(),
        source,
        metadata: { action, isAdminAction: true }
      });
    } catch (error) {
      onBroadcastError?.(error as Error, {
        type: 'user-action-change',
        oldValue: null,
        newValue: data,
        timestamp: Date.now(),
        source,
        metadata: { action, isAdminAction: true }
      });
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Broadcast immediate (no debouncing)
  const broadcastImmediate = useCallback(async (
    payload: StateChangePayload,
    pusherAction: EventAction
  ) => {
    if (!broadcaster.current || !isInitialized.current) return;

    try {
      await broadcaster.current.broadcastImmediate(payload, pusherAction);
      onBroadcastSuccess?.(payload);
    } catch (error) {
      onBroadcastError?.(error as Error, payload);
    }
  }, [broadcaster, onBroadcastSuccess, onBroadcastError]);

  // Get broadcaster statistics
  const getStatistics = useCallback(() => {
    return broadcaster.current?.getStatistics() || null;
  }, [broadcaster]);

  // Check if broadcaster is ready
  const isReady = useCallback(() => {
    return broadcaster.current !== null && isInitialized.current;
  }, [broadcaster]);

  return {
    // Broadcasting methods
    broadcastEventStatusChange,
    broadcastPageEnablementChange,
    broadcastEventConfigChange,
    broadcastLoadingStateChange,
    broadcastErrorStateChange,
    broadcastUserAction,
    broadcastSystemEvent,
    broadcastAdminAction,
    broadcastImmediate,
    
    // Utility methods
    getStatistics,
    isReady
  };
};
