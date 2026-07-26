/**
 * Provider-neutral playback types (PRD-07).
 * Use interfaces for shared data (project convention).
 */

export type PlaybackMode = 'spotify' | 'manual';

export type ProviderErrorCategory =
  | 'capability_not_supported'
  | 'not_connected'
  | 'rate_limit'
  | 'no_active_device'
  | 'provider_outage'
  | 'expired_authorization'
  | 'validation'
  | 'uncertain_timeout'
  | 'unknown';

export interface PlaybackCapabilities {
  search: boolean;
  queueAdd: boolean;
  /** Native provider queue reorder (Spotify: false). App-owned reorder is separate. */
  providerQueueReorder: boolean;
  /** PartyPlaylist approved-request order (always true for both modes). */
  appOwnedQueueReorder: boolean;
  playbackControls: boolean;
  nowPlaying: boolean;
  deviceSelection: boolean;
  volume: boolean;
  /** Manual text requests (artist + title) without provider catalogue. */
  manualTextRequest: boolean;
  markPlaying: boolean;
}

export interface EventPlaybackContext {
  userId: string;
  eventId?: string | null;
  username?: string;
  deviceId?: string;
}

export type ConnectionStatusState =
  | 'connected'
  | 'disconnected'
  | 'degraded'
  | 'not_required'
  | 'error';

export interface ConnectionStatus {
  state: ConnectionStatusState;
  providerId: string;
  message?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface ProviderTrack {
  providerId: string;
  providerTrackId?: string | null;
  uri?: string | null;
  title: string;
  artists: string;
  album?: string | null;
  artworkUrl?: string | null;
  durationMs?: number;
  explicit?: boolean;
}

export interface TrackSearchResult extends ProviderTrack {
  previewUrl?: string | null;
}

export interface PlaybackSnapshot {
  providerId: string;
  isPlaying: boolean;
  progressMs?: number;
  durationMs?: number;
  track?: ProviderTrack | null;
  deviceName?: string | null;
  volumePercent?: number | null;
  fetchedAt: string;
  /** True when snapshot is app-owned (manual), not provider telemetry. */
  appOwned: boolean;
  label?: string;
}

export interface OperationResult {
  ok: boolean;
  code?: string;
  category?: ProviderErrorCategory;
  message?: string;
}

export interface QueueOperationResult extends OperationResult {
  providerOperationId?: string | null;
}

export interface ManualNowPlaying {
  requestId?: string | null;
  title: string;
  artists: string;
  album?: string | null;
  artworkUrl?: string | null;
  setAt: string;
  setBy?: string | null;
}
