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
