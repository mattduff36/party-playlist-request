import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  refuseIfCapabilityUnsupported,
  runProviderControl,
} from '@/lib/playback/gate-capability';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    const refused = await refuseIfCapabilityUnsupported(
      userId,
      'volume',
      'playback.volume'
    );
    if (refused) return refused;

    const body = await req.json().catch(() => ({}));
    const volume = body.volume;
    const deviceId =
      typeof body.device_id === 'string' ? body.device_id : undefined;

    if (volume === undefined || volume === null || Number.isNaN(Number(volume))) {
      return NextResponse.json(
        { error: 'Volume is required (0-100)' },
        { status: 400 }
      );
    }

    const volumePercent = Math.max(0, Math.min(100, Math.round(Number(volume))));

    const result = await runProviderControl(
      userId,
      'setVolume',
      { userId, deviceId },
      volumePercent
    );

    if (!result.ok) {
      const status = result.code === 'CAPABILITY_NOT_SUPPORTED' ? 501 : 500;
      return NextResponse.json(
        { error: result.message || 'Failed to set volume', code: result.code },
        { status }
      );
    }

    return NextResponse.json({ success: true, volume: volumePercent });
  } catch (error) {
    console.error('Failed to set volume:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to set volume',
      },
      { status: 500 }
    );
  }
}
