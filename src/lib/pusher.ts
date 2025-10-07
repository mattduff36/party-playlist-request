import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'fallback-app-id',
  key: process.env.PUSHER_KEY || 'fallback-key',
  secret: process.env.PUSHER_SECRET || 'fallback-secret',
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true,
});

// Client-side Pusher instance (for browser)
export const createPusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY || 'fallback-key';
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';
  
  return new PusherClient(key, {
    cluster: cluster,
    forceTLS: true,
  });
};

// Event types for type safety
export interface RequestApprovedEvent {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  track_uri: string;
  requester_nickname: string;
  user_session_id?: string; // For user notification tracking
  play_next?: boolean; // Whether this was added as "play next"
  approved_at: string;
  approved_by: string;
}

export interface RequestRejectedEvent {
  id: string;
  track_name: string;
  artist_name: string;
  requester_nickname: string;
  rejected_at: string;
  rejected_by: string;
}

export interface RequestDeletedEvent {
  id: string;
  track_name: string;
  artist_name: string;
  status: string;
  deleted_at: string;
}

export interface RequestSubmittedEvent {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  track_uri: string;
  requester_nickname: string;
  submitted_at: string;
}

export interface PlaybackUpdateEvent {
  current_track: any;
  queue: any[];
  is_playing: boolean;
  progress_ms: number;
  timestamp: number;
}

export interface TokenExpiredEvent {
  reason: 'expired' | 'invalid' | 'revoked';
  message: string;
  timestamp: number;
}

export interface AdminLoginEvent {
  admin_id: string;
  username: string;
  login_time: string;
  message: string;
}

export interface AdminLogoutEvent {
  admin_id?: string;
  username?: string;
  logout_time: string;
  message: string;
}

// Pusher channel helpers - USER-SPECIFIC channels for multi-tenancy
export const getUserChannel = (userId: string) => `private-party-playlist-${userId}`;
export const getAdminChannel = (userId: string) => `private-admin-updates-${userId}`;

// Legacy global channels (DEPRECATED - DO NOT USE for user-specific events)
export const CHANNELS = {
  PARTY_PLAYLIST: 'party-playlist', // ⚠️ DEPRECATED: Use getUserChannel(userId) instead
  ADMIN_UPDATES: 'admin-updates',   // ⚠️ DEPRECATED: Use getAdminChannel(userId) instead
} as const;

// Pusher events
export const EVENTS = {
  REQUEST_APPROVED: 'request-approved',
  REQUEST_REJECTED: 'request-rejected',
  REQUEST_SUBMITTED: 'request-submitted',
  REQUEST_DELETED: 'request-deleted',
  PLAYBACK_UPDATE: 'playback-update',
  STATS_UPDATE: 'stats-update',
  QUEUE_UPDATE: 'queue-update',
  PAGE_CONTROL_TOGGLE: 'page-control-toggle',
  STATE_UPDATE: 'state-update',
  TOKEN_EXPIRED: 'token-expired',
  ADMIN_LOGIN: 'admin-login',
  ADMIN_LOGOUT: 'admin-logout',
} as const;

// Helper function to trigger events
export const triggerEvent = async (
  channel: string,
  event: string,
  data: any
) => {
  try {
    await pusherServer.trigger(channel, event, {
      ...data,
      timestamp: Date.now(),
    });
    console.log(`📡 Pusher event sent: ${channel}/${event}`, data);
  } catch (error) {
    console.error('❌ Pusher trigger failed:', error);
    throw error;
  }
};

// Specific event triggers
export const triggerRequestApproved = async (data: RequestApprovedEvent) => {
  await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.REQUEST_APPROVED, data);
};

export const triggerRequestRejected = async (data: RequestRejectedEvent) => {
  await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.REQUEST_REJECTED, data);
};

export const triggerRequestDeleted = async (data: RequestDeletedEvent) => {
  await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.REQUEST_DELETED, data);
};

export const triggerRequestSubmitted = async (data: RequestSubmittedEvent) => {
  await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.REQUEST_SUBMITTED, data);
};

export const triggerPlaybackUpdate = async (data: PlaybackUpdateEvent) => {
  // Reduce payload size to avoid Pusher 10KB limit
  const compactData = {
    current_track: data.current_track ? {
      id: data.current_track.id,
      name: data.current_track.name?.substring(0, 100) || '',
      artists: data.current_track.artists?.slice(0, 2).map((a: any) => ({ name: a.name?.substring(0, 50) || '' })) || [],
      album: data.current_track.album ? {
        name: data.current_track.album.name?.substring(0, 100) || '',
        images: data.current_track.album.images?.slice(0, 1).map((img: any) => ({
          url: img.url,
          width: img.width,
          height: img.height
        })) || [] // Only keep first image with minimal data
      } : null,
      uri: data.current_track.uri,
      duration_ms: data.current_track.duration_ms
    } : null,
    queue: data.queue?.slice(0, 10).map((track: any) => ({ // Limit to 10 tracks to stay under 10KB
      id: track.id,
      name: track.name?.substring(0, 100) || '', // Truncate long names
      artists: track.artists?.slice(0, 2).map((a: any) => ({ name: a.name?.substring(0, 50) || '' })) || [],
      uri: track.uri,
      requester_nickname: track.requester_nickname?.substring(0, 30) || null
    })) || [],
    is_playing: data.is_playing,
    progress_ms: data.progress_ms,
    timestamp: data.timestamp
  };
  
  await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.PLAYBACK_UPDATE, compactData);
};

export const triggerStatsUpdate = async (stats: any) => {
  await triggerEvent(CHANNELS.ADMIN_UPDATES, EVENTS.STATS_UPDATE, stats);
};

export const triggerTokenExpired = async (data: TokenExpiredEvent) => {
  await triggerEvent(CHANNELS.ADMIN_UPDATES, EVENTS.TOKEN_EXPIRED, data);
};

export const triggerAdminLogin = async (data: AdminLoginEvent) => {
  await triggerEvent(CHANNELS.ADMIN_UPDATES, EVENTS.ADMIN_LOGIN, data);
};

export const triggerAdminLogout = async (data: AdminLogoutEvent) => {
  await triggerEvent(CHANNELS.ADMIN_UPDATES, EVENTS.ADMIN_LOGOUT, data);
};

// State update event interface
export interface StateUpdateEvent {
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
  userId: string; // Required for user-specific channel
}

export const triggerStateUpdate = async (data: StateUpdateEvent) => {
  const userChannel = getUserChannel(data.userId);
  await triggerEvent(userChannel, EVENTS.STATE_UPDATE, data);
};

// Page control update event interface
export interface PageControlUpdateEvent {
  page: 'requests' | 'display';
  enabled: boolean;
  pagesEnabled: {
    requests: boolean;
    display: boolean;
  };
  adminId?: string;
  adminName?: string;
  userId: string; // Required for user-specific channel
}

export const triggerPageControlUpdate = async (data: PageControlUpdateEvent) => {
  const userChannel = getUserChannel(data.userId);
  await triggerEvent(userChannel, EVENTS.PAGE_CONTROL_TOGGLE, data);
};