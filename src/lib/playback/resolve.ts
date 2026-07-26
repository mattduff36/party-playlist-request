/**
 * Resolve the active PlaybackProvider for a user/event (PRD-07).
 */

import type { PlaybackProvider } from './provider';
import { spotifyPlaybackProvider } from './spotify-provider';
import { manualPlaybackProvider } from './manual-provider';
import { getPlaybackMode } from './mode';
import type { PlaybackCapabilities, PlaybackMode } from './types';

export function getProviderByMode(mode: PlaybackMode): PlaybackProvider {
  return mode === 'manual' ? manualPlaybackProvider : spotifyPlaybackProvider;
}

export async function resolvePlaybackProvider(
  userId: string
): Promise<{ mode: PlaybackMode; provider: PlaybackProvider }> {
  const mode = await getPlaybackMode(userId);
  return { mode, provider: getProviderByMode(mode) };
}

export async function getProviderCapabilities(
  userId: string
): Promise<{ mode: PlaybackMode; capabilities: PlaybackCapabilities }> {
  const { mode, provider } = await resolvePlaybackProvider(userId);
  return { mode, capabilities: provider.getCapabilities() };
}
