/**
 * Centralized Pusher Event Handling System
 * 
 * This module provides a unified event system using a single channel per event
 * with action-based events for better organization and type safety.
 */

// Event ID for unique identification and deduplication
export type EventId = string;

// Event timestamp for ordering
export type EventTimestamp = number;

// Event version for conflict resolution
export type EventVersion = number;

// Base event interface
export interface BaseEvent {
  id: EventId;
  timestamp: EventTimestamp;
  version: EventVersion;
  eventId: string; // The global event ID this belongs to
}

// Event action types
export type EventAction = 
  | 'state_update'
  | 'state_change'
  | 'request_approved'
  | 'request_rejected'
  | 'request_submitted'
  | 'request_deleted'
  | 'playback_update'
  | 'page_control_toggle'
  | 'admin_login'
  | 'admin_logout'
  | 'token_expired'
  | 'stats_update'
  | 'error_occurred'
  | 'heartbeat';

// State update event
export interface StateUpdateEvent extends BaseEvent {
  action: 'state_update';
  data: {
    status: 'offline' | 'standby' | 'live';
    pagesEnabled: {
      requests: boolean;
      display: boolean;
    };
    config: {
      event_title?: string;
      welcome_message?: string;
      secondary_message?: string;
      tertiary_message?: string;
    };
    adminId?: string;
    adminName?: string;
  };
}

// Generic state change log event
export interface StateChangeEvent extends BaseEvent {
  action: 'state_change';
  data: {
    type: 
      | 'event-status-change'
      | 'page-enablement-change'
      | 'event-config-change'
      | 'loading-state-change'
      | 'error-state-change'
      | 'user-action-change';
    oldValue: any;
    newValue: any;
    timestamp: number;
    source: 'user' | 'system' | 'admin';
    metadata?: Record<string, any>;
  };
}

// Request events
export interface RequestApprovedEvent extends BaseEvent {
  action: 'request_approved';
  data: {
    requestId: string;
    trackName: string;
    artistName: string;
    albumName: string;
    trackUri: string;
    requesterNickname: string;
    userSessionId?: string;
    playNext?: boolean;
    approvedAt: string;
    approvedBy: string;
  };
}

export interface RequestRejectedEvent extends BaseEvent {
  action: 'request_rejected';
  data: {
    requestId: string;
    trackName: string;
    artistName: string;
    requesterNickname: string;
    rejectedAt: string;
    rejectedBy: string;
    reason?: string;
  };
}

export interface RequestSubmittedEvent extends BaseEvent {
  action: 'request_submitted';
  data: {
    requestId: string;
    trackName: string;
    artistName: string;
    albumName: string;
    trackUri: string;
    requesterNickname: string;
    userSessionId: string;
    submittedAt: string;
  };
}

export interface RequestDeletedEvent extends BaseEvent {
  action: 'request_deleted';
  data: {
    requestId: string;
    trackName: string;
    artistName: string;
    deletedAt: string;
    deletedBy: string;
    reason?: string;
  };
}

// Playback events
export interface PlaybackUpdateEvent extends BaseEvent {
  action: 'playback_update';
  data: {
    currentTrack?: {
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album?: {
        name: string;
        images?: Array<{ url: string; width: number; height: number }>;
      };
      uri: string;
      durationMs: number;
    };
    queue: Array<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      uri: string;
      requesterNickname?: string;
    }>;
    isPlaying: boolean;
    progressMs: number;
  };
}

// Page control events
export interface PageControlToggleEvent extends BaseEvent {
  action: 'page_control_toggle';
  data: {
    page: 'requests' | 'display';
    enabled: boolean;
    toggledBy: string;
    toggledAt: string;
  };
}

// Admin events
export interface AdminLoginEvent extends BaseEvent {
  action: 'admin_login';
  data: {
    adminId: string;
    username: string;
    loginTime: string;
    message: string;
  };
}

export interface AdminLogoutEvent extends BaseEvent {
  action: 'admin_logout';
  data: {
    adminId?: string;
    username?: string;
    logoutTime: string;
    message: string;
  };
}

// Token events
export interface TokenExpiredEvent extends BaseEvent {
  action: 'token_expired';
  data: {
    reason: 'expired' | 'invalid' | 'revoked';
    message: string;
    affectedService: 'spotify' | 'pusher' | 'database';
  };
}

// Stats events
export interface StatsUpdateEvent extends BaseEvent {
  action: 'stats_update';
  data: {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    activeUsers: number;
    lastUpdated: string;
  };
}

// Error events
export interface ErrorOccurredEvent extends BaseEvent {
  action: 'error_occurred';
  data: {
    errorType: 'connection' | 'authentication' | 'validation' | 'server' | 'client';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    service: string;
    details?: Record<string, any>;
  };
}

// Heartbeat events
export interface HeartbeatEvent extends BaseEvent {
  action: 'heartbeat';
  data: {
    serverTime: string;
    uptime: number;
    activeConnections: number;
  };
}

// Union type for all events
export type PusherEvent = 
  | StateUpdateEvent
  | StateChangeEvent
  | RequestApprovedEvent
  | RequestRejectedEvent
  | RequestSubmittedEvent
  | RequestDeletedEvent
  | PlaybackUpdateEvent
  | PageControlToggleEvent
  | AdminLoginEvent
  | AdminLogoutEvent
  | TokenExpiredEvent
  | StatsUpdateEvent
  | ErrorOccurredEvent
  | HeartbeatEvent;

// Event handler type
export type EventHandler<T extends PusherEvent = PusherEvent> = (event: T) => void;

// Event handlers map
export interface EventHandlers {
  state_update?: EventHandler<StateUpdateEvent>;
  state_change?: EventHandler<StateChangeEvent>;
  request_approved?: EventHandler<RequestApprovedEvent>;
  request_rejected?: EventHandler<RequestRejectedEvent>;
  request_submitted?: EventHandler<RequestSubmittedEvent>;
  request_deleted?: EventHandler<RequestDeletedEvent>;
  playback_update?: EventHandler<PlaybackUpdateEvent>;
  page_control_toggle?: EventHandler<PageControlToggleEvent>;
  admin_login?: EventHandler<AdminLoginEvent>;
  admin_logout?: EventHandler<AdminLogoutEvent>;
  token_expired?: EventHandler<TokenExpiredEvent>;
  stats_update?: EventHandler<StatsUpdateEvent>;
  error_occurred?: EventHandler<ErrorOccurredEvent>;
  heartbeat?: EventHandler<HeartbeatEvent>;
}

// Channel naming convention
export const getEventChannel = (eventId: string): string => {
  return `event-${eventId}`;
};

// Event ID generation
export const generateEventId = (): EventId => {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Event version generation
export const generateEventVersion = (): EventVersion => {
  return Date.now();
};

// Event validation
export const isValidEvent = (event: any): event is PusherEvent => {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.timestamp === 'number' &&
    typeof event.version === 'number' &&
    typeof event.eventId === 'string' &&
    typeof event.action === 'string' &&
    event.data !== undefined
  );
};

// Event deduplication key
export const getEventDeduplicationKey = (event: PusherEvent): string => {
  return `${event.eventId}-${event.action}-${event.id}`;
};

// Event ordering comparison
export const compareEvents = (a: PusherEvent, b: PusherEvent): number => {
  // First compare by timestamp
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  
  // Then compare by version for same timestamp
  if (a.version !== b.version) {
    return a.version - b.version;
  }
  
  // Finally compare by ID for same timestamp and version
  return a.id.localeCompare(b.id);
};
