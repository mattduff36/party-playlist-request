/**
 * Shared capability gate for admin playback control routes (PRD-07).
 */

import { NextResponse } from 'next/server';
import {
  getProviderCapabilities,
  resolvePlaybackProvider,
  type EventPlaybackContext,
  type OperationResult,
} from '@/lib/playback';
import type { PlaybackCapabilities } from '@/lib/playback/types';

export async function refuseIfCapabilityUnsupported(
  userId: string,
  capability: keyof PlaybackCapabilities,
  label: string
): Promise<NextResponse | null> {
  const { capabilities } = await getProviderCapabilities(userId);
  if (capabilities[capability]) return null;
  return NextResponse.json(
    {
      success: false,
      code: 'CAPABILITY_NOT_SUPPORTED',
      error: `Capability not supported: ${label}`,
      capability: label,
    },
    { status: 501 }
  );
}

export async function runProviderControl(
  userId: string,
  action: 'pause' | 'resume' | 'skip' | 'setVolume',
  context: EventPlaybackContext,
  volume?: number
): Promise<OperationResult> {
  const { provider } = await resolvePlaybackProvider(userId);
  if (action === 'pause' && provider.pause) return provider.pause(context);
  if (action === 'resume' && provider.resume) return provider.resume(context);
  if (action === 'skip' && provider.skip) return provider.skip(context);
  if (action === 'setVolume' && provider.setVolume && typeof volume === 'number') {
    return provider.setVolume(volume, context);
  }
  return {
    ok: false,
    code: 'CAPABILITY_NOT_SUPPORTED',
    category: 'capability_not_supported',
    message: `Provider does not support ${action}`,
  };
}
