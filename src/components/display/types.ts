export interface CurrentTrack {
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  progress_ms: number;
  uri: string;
  image_url?: string;
}

export interface QueueItem {
  name: string;
  artists: string[];
  album: string;
  uri: string;
  requester_nickname?: string;
}

export interface Notification {
  id: string;
  type: 'approval' | 'rejection' | 'info';
  message: string;
  requester_name?: string;
  track_name?: string;
  created_at: string;
  shown: boolean;
}

export interface RequestItem {
  id: string;
  track_name: string;
  artist_name: string;
  requester_nickname?: string;
  created_at: string;
}

export interface DisplayMessage {
  text: string;
  duration: number | null;
  created_at: string;
}

export type DisplayDeviceType = 'tv' | 'tablet' | 'mobile';

export type NowPlayingVariant =
  | 'tv'
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'mobile-landscape'
  | 'mobile-portrait';

export type QueueVariant =
  | 'tv'
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'mobile-landscape'
  | 'mobile-portrait';

export type QrVariant =
  | 'tv'
  | 'tablet-landscape'
  | 'mobile-landscape';

export type ScrollingBarVariant =
  | 'tv'
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'mobile-landscape'
  | 'mobile-portrait';

export type MessageOverlayVariant = 'tv' | 'tablet' | 'mobile';
