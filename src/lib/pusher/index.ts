/**
 * Centralized Pusher System
 * 
 * This module exports all the centralized Pusher functionality including
 * event types, client, broadcaster, and React hooks.
 */

// Export event types and utilities
export * from './events';

// Export client
export * from './client';

// Export broadcaster
export {
  broadcastEvent as broadcasterBroadcastEvent,
  broadcastEvents as broadcasterBroadcastEvents,
  getBroadcasterStats,
  clearBroadcastQueue,
  broadcastStateUpdate,
  broadcastRequestApproved,
  broadcastRequestRejected,
  broadcastRequestSubmitted,
  broadcastRequestDeleted,
  broadcastPlaybackUpdate,
  broadcastPageControlToggle,
  broadcastAdminLogin,
  broadcastAdminLogout,
  broadcastTokenExpired,
  broadcastStatsUpdate,
  broadcastErrorOccurred,
  broadcastHeartbeat
} from './broadcaster';

// Export event manager
export * from './event-manager';

// Export deduplication
export * from './deduplication';

// Export reconnection
export * from './reconnection';

// Export fallback
export * from './fallback';

// Export state broadcasting
export * from './state-broadcaster';

// Export rate limiting
export * from './rate-limiter';

// Export React hooks
export * from '../../hooks/useCentralizedPusher';
export * from '../../hooks/useEventManager';
export * from '../../hooks/useStateBroadcaster';

// Re-export legacy Pusher functionality for backward compatibility
export { 
  pusherServer, 
  pusherServer as pusher,
  createPusherClient, 
  triggerEvent,
  triggerRequestApproved,
  triggerRequestRejected,
  triggerRequestDeleted,
  triggerRequestSubmitted,
  triggerPlaybackUpdate,
  triggerStatsUpdate,
  triggerTokenExpired,
  triggerAdminLogin,
  triggerAdminLogout,
  CHANNELS,
  EVENTS
} from '../pusher';
