import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Client-side Pusher instance (for browser)
export const createPusherClient = () => {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
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

export interface PlaybackUpdateEvent {
  current_track: any;
  queue: any[];
  is_playing: boolean;
  progress_ms: number;
  timestamp: number;
}

// Pusher channels
export const CHANNELS = {
  PARTY_PLAYLIST: 'party-playlist',
  ADMIN_UPDATES: 'admin-updates',
} as const;

// Pusher events
export const EVENTS = {
  REQUEST_APPROVED: 'request-approved',
  REQUEST_REJECTED: 'request-rejected',
  PLAYBACK_UPDATE: 'playback-update',
  STATS_UPDATE: 'stats-update',
  QUEUE_UPDATE: 'queue-update',
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

export const triggerPlaybackUpdate = async (data: PlaybackUpdateEvent) => {
  await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.PLAYBACK_UPDATE, data);
};

export const triggerStatsUpdate = async (stats: any) => {
  await triggerEvent(CHANNELS.ADMIN_UPDATES, EVENTS.STATS_UPDATE, stats);
};
