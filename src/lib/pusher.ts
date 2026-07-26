import Pusher from 'pusher';
import { getTrackAlbumImageUrl } from '@/lib/spotify-album-art';
import { resolveSecretEnv } from '@/lib/security/fail-closed-env';
import {
  getUserChannel,
  getAdminChannel,
  EVENTS,
} from '@/lib/pusher/client-shared';
import { dualPublishUserAndGuest } from '@/lib/pusher/dual-publish';
import type {
  RequestApprovedEvent,
  RequestRejectedEvent,
  RequestDeletedEvent,
  RequestSubmittedEvent,
} from '@/lib/pusher/client-shared';

export {
  createPusherClient,
  getUserChannel,
  getAdminChannel,
  EVENTS,
} from '@/lib/pusher/client-shared';
export type {
  RequestApprovedEvent,
  RequestRejectedEvent,
  RequestDeletedEvent,
  RequestSubmittedEvent,
} from '@/lib/pusher/client-shared';

function createPusherServer(): Pusher {
  return new Pusher({
    appId: resolveSecretEnv('PUSHER_APP_ID', {
      insecureFallbacks: ['fallback-app-id'],
      devFallback: 'fallback-app-id',
    }),
    key: resolveSecretEnv('PUSHER_KEY', {
      insecureFallbacks: ['fallback-key'],
      devFallback: 'fallback-key',
    }),
    secret: resolveSecretEnv('PUSHER_SECRET', {
      insecureFallbacks: ['fallback-secret'],
      devFallback: 'fallback-secret',
    }),
    cluster: process.env.PUSHER_CLUSTER?.trim() || 'us2',
    useTLS: true,
  });
}

let pusherServerInstance: Pusher | null = null;

/** Lazy server Pusher — fails closed in production if credentials are missing/fallback. */
export function getPusherServer(): Pusher {
  if (!pusherServerInstance) {
    pusherServerInstance = createPusherServer();
  }
  return pusherServerInstance;
}

/** @deprecated Prefer getPusherServer() — kept for existing imports. */
export const pusherServer = new Proxy({} as Pusher, {
  get(_target, prop, receiver) {
    const instance = getPusherServer();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

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

// Legacy global channels (DEPRECATED - DO NOT USE for user-specific events)
export const CHANNELS = {
  PARTY_PLAYLIST: 'party-playlist', // ⚠️ DEPRECATED: Use getUserChannel(userId) instead
  ADMIN_UPDATES: 'admin-updates',   // ⚠️ DEPRECATED: Use getAdminChannel(userId) instead
} as const;

// Helper function to trigger events
export const triggerEvent = async (
  channel: string,
  event: string,
  data: any
) => {
  try {
    // Strip obviously sensitive keys before publish (PRD-04 minimise payloads)
    const safe =
      data && typeof data === 'object'
        ? Object.fromEntries(
            Object.entries(data).filter(
              ([key]) =>
                !/^(email|access_code|accessCode|pin|password|refresh_token|access_token|code_verifier|bypass_token|displayToken|display_token|requester_ip_hash)$/i.test(
                  key
                )
            )
          )
        : data;
    await getPusherServer().trigger(channel, event, {
      ...safe,
      timestamp: Date.now(),
    });
    console.log(`📡 Pusher event sent: ${channel}/${event}`);
  } catch (error) {
    console.error('❌ Pusher trigger failed:', error);
    throw error;
  }
};

// Specific event triggers (USER-SPECIFIC + event guest dual-publish)
export const triggerRequestApproved = async (data: RequestApprovedEvent & { userId: string }) => {
  await dualPublishUserAndGuest(data.userId, EVENTS.REQUEST_APPROVED, data as unknown as Record<string, unknown>);
};

export const triggerRequestRejected = async (data: RequestRejectedEvent & { userId: string }) => {
  await dualPublishUserAndGuest(data.userId, EVENTS.REQUEST_REJECTED, data as unknown as Record<string, unknown>);
};

export const triggerRequestDeleted = async (data: RequestDeletedEvent & { userId: string }) => {
  await dualPublishUserAndGuest(data.userId, EVENTS.REQUEST_DELETED, data as unknown as Record<string, unknown>);
};

export const triggerRequestsCleanup = async (userId: string) => {
  const adminChannel = getAdminChannel(userId);

  const data = {
    message: 'All requests have been cleared',
    timestamp: new Date().toISOString(),
    userId
  };

  await triggerEvent(adminChannel, EVENTS.REQUESTS_CLEANUP, data);
  await dualPublishUserAndGuest(userId, EVENTS.REQUESTS_CLEANUP, data);
};

export const triggerRequestSubmitted = async (data: RequestSubmittedEvent & { userId: string }) => {
  await dualPublishUserAndGuest(data.userId, EVENTS.REQUEST_SUBMITTED, data as unknown as Record<string, unknown>);
};

export const triggerPlaybackUpdate = async (data: PlaybackUpdateEvent & { userId: string }) => {
  // Reduce payload size to avoid Pusher 10KB limit
  const compactArtist = (artist: string | { name?: string } | null | undefined) => {
    const name = typeof artist === 'string' ? artist : artist?.name;
    return { name: (name || '').substring(0, 50) };
  };

  const compactData = {
    current_track: data.current_track ? {
      id: data.current_track.id,
      name: data.current_track.name?.substring(0, 100) || '',
      // Watcher may send string[] or Spotify-style { name }[]; support both
      artists: data.current_track.artists?.slice(0, 2).map(compactArtist) || [],
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
    // Single image_url per track (~90B) — no full album.images arrays / extra Spotify calls
    queue: data.queue?.slice(0, 10).map((track: any) => ({
      id: track.id,
      name: track.name?.substring(0, 100) || '', // Truncate long names
      artists: track.artists?.slice(0, 2).map(compactArtist) || [],
      uri: track.uri,
      image_url: getTrackAlbumImageUrl(track) || null,
      requester_nickname: track.requester_nickname?.substring(0, 30) || null
    })) || [],
    is_playing: data.is_playing,
    progress_ms: data.progress_ms,
    timestamp: data.timestamp,
    userId: data.userId
  };
  
  await dualPublishUserAndGuest(
    data.userId,
    EVENTS.PLAYBACK_UPDATE,
    compactData as Record<string, unknown>
  );
};

export const triggerStatsUpdate = async (stats: any & { userId: string }) => {
  const userChannel = getAdminChannel(stats.userId);
  await triggerEvent(userChannel, EVENTS.STATS_UPDATE, stats);
};

export const triggerTokenExpired = async (
  data: TokenExpiredEvent & { userId: string }
) => {
  // Tenant-scoped admin channel (usePusher already binds TOKEN_EXPIRED here)
  await triggerEvent(getAdminChannel(data.userId), EVENTS.TOKEN_EXPIRED, data);
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
  await dualPublishUserAndGuest(
    data.userId,
    EVENTS.STATE_UPDATE,
    data as unknown as Record<string, unknown>
  );
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
  await dualPublishUserAndGuest(
    data.userId,
    EVENTS.PAGE_CONTROL_TOGGLE,
    data as unknown as Record<string, unknown>
  );
};

// Force logout event (for session transfer)
export const triggerForceLogout = async (userId: string, sessionId: string, reason: string = 'Session transferred') => {
  const adminChannel = getAdminChannel(userId);
  await triggerEvent(adminChannel, EVENTS.FORCE_LOGOUT, {
    userId,
    sessionId,
    reason,
    message: 'You have been logged out because this session was transferred to another device.'
  });
};