/**
 * Client-safe Pusher helpers (no server/pg imports).
 */

import PusherClient from 'pusher-js';
import { isProductionRuntime } from '@/lib/security/fail-closed-env';

export const getUserChannel = (userId: string) =>
  `private-party-playlist-${userId}`;
export const getAdminChannel = (userId: string) =>
  `private-admin-updates-${userId}`;

export const EVENTS = {
  REQUEST_APPROVED: 'request-approved',
  REQUEST_REJECTED: 'request-rejected',
  REQUEST_SUBMITTED: 'request-submitted',
  REQUEST_DELETED: 'request-deleted',
  REQUESTS_CLEANUP: 'requests-cleanup',
  PLAYBACK_UPDATE: 'playback-update',
  STATS_UPDATE: 'stats-update',
  QUEUE_UPDATE: 'queue-update',
  PAGE_CONTROL_TOGGLE: 'page-control-toggle',
  STATE_UPDATE: 'state-update',
  TOKEN_EXPIRED: 'token-expired',
  ADMIN_LOGIN: 'admin-login',
  ADMIN_LOGOUT: 'admin-logout',
  SESSION_TRANSFERRED: 'session-transferred',
  FORCE_LOGOUT: 'force-logout',
} as const;

export const createPusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim() || '';
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim() || '';

  if (isProductionRuntime() && (!key || key === 'fallback-key')) {
    throw new Error(
      'NEXT_PUBLIC_PUSHER_KEY must be configured in production (fail-closed)'
    );
  }

  return new PusherClient(key || 'fallback-key', {
    cluster: cluster || 'us2',
    forceTLS: true,
    authEndpoint: '/api/pusher/auth',
  });
};

export interface RequestApprovedEvent {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  track_uri: string;
  requester_nickname: string;
  user_session_id?: string;
  play_next?: boolean;
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
  album_image_url?: string | null;
  track_uri: string;
  requester_nickname: string;
  submitted_at: string;
}

/** Compact Spotify-shaped track used on playback / queue realtime payloads */
export interface PlaybackTrackPayload {
  id?: string;
  name?: string;
  artists?: Array<string | { name?: string }>;
  album?: {
    name?: string;
    images?: Array<{ url?: string; width?: number; height?: number }>;
  };
  uri?: string;
  duration_ms?: number;
  image_url?: string | null;
  requester_nickname?: string | null;
}

export interface PlaybackUpdatePayload {
  current_track?: PlaybackTrackPayload | null;
  queue?: PlaybackTrackPayload[];
  is_playing?: boolean;
  progress_ms?: number;
  timestamp?: number;
  userId?: string;
  device?: {
    name?: string;
    volume_percent?: number;
    [key: string]: unknown;
  };
}

export interface StatsUpdatePayload {
  userId?: string;
  total?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  played?: number;
  totalRequests?: number;
  approvedRequests?: number;
  rejectedRequests?: number;
  pendingRequests?: number;
  activeUsers?: number;
  lastUpdated?: string;
  total_requests?: number;
  pending_requests?: number;
  approved_requests?: number;
  rejected_requests?: number;
  played_requests?: number;
  unique_requesters?: number;
  spotify_connected?: boolean;
}

export interface PageControlTogglePayload {
  page?: 'requests' | 'display';
  enabled?: boolean;
  pagesEnabled?: {
    requests?: boolean;
    display?: boolean;
  };
  adminId?: string;
  adminName?: string;
  userId?: string;
  status?: 'offline' | 'standby' | 'live';
  config?: Record<string, unknown>;
}

export interface MessageUpdatePayload {
  message?: string;
  text?: string;
  duration?: number;
  created_at?: string;
  message_text?: string | null;
  message_duration?: number | null;
  message_created_at?: string | null;
  settings?: Record<string, unknown>;
}

export interface TokenExpiredPayload {
  reason?: 'expired' | 'invalid' | 'revoked';
  message?: string;
  timestamp?: number;
}

export interface AdminLoginPayload {
  admin_id?: string;
  username?: string;
  login_time?: string;
  message?: string;
}

export interface AdminLogoutPayload {
  admin_id?: string;
  username?: string;
  logout_time?: string;
  message?: string;
}

export interface ForceLogoutPayload {
  userId?: string;
  sessionId?: string;
  reason?: string;
  message?: string;
}

export interface RequestsCleanupPayload {
  message?: string;
  timestamp?: string;
  userId?: string;
}

export interface SettingsUpdatePayload {
  settings?: Record<string, unknown>;
}
