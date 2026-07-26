/**
 * Server-only playback provider contract (PRD-07).
 */

import type {
  ConnectionStatus,
  EventPlaybackContext,
  OperationResult,
  PlaybackCapabilities,
  PlaybackSnapshot,
  ProviderTrack,
  QueueOperationResult,
  TrackSearchResult,
} from './types';

export interface PlaybackProvider {
  readonly id: string;
  getCapabilities(): PlaybackCapabilities;
  getConnectionStatus(context: EventPlaybackContext): Promise<ConnectionStatus>;
  searchTracks?(
    query: string,
    context: EventPlaybackContext
  ): Promise<TrackSearchResult[]>;
  getPlaybackState?(
    context: EventPlaybackContext
  ): Promise<PlaybackSnapshot>;
  addToQueue?(
    track: ProviderTrack,
    context: EventPlaybackContext
  ): Promise<QueueOperationResult>;
  pause?(context: EventPlaybackContext): Promise<OperationResult>;
  resume?(context: EventPlaybackContext): Promise<OperationResult>;
  skip?(context: EventPlaybackContext): Promise<OperationResult>;
  setVolume?(
    value: number,
    context: EventPlaybackContext
  ): Promise<OperationResult>;
}

export function unsupportedResult(
  capability: string,
  message?: string
): OperationResult {
  return {
    ok: false,
    code: 'CAPABILITY_NOT_SUPPORTED',
    category: 'capability_not_supported',
    message: message ?? `Capability not supported: ${capability}`,
  };
}

export function assertCapability(
  capabilities: PlaybackCapabilities,
  key: keyof PlaybackCapabilities,
  label: string
): OperationResult | null {
  if (capabilities[key]) return null;
  return unsupportedResult(label);
}
