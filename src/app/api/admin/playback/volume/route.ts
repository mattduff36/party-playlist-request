import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
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

    await spotifyService.setVolume(volumePercent, deviceId, userId);

    return NextResponse.json({ success: true, volume: volumePercent });
  } catch (error) {
    console.error('Failed to set volume:', error);
    let errorMessage = 'Failed to set volume';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('NO_ACTIVE_DEVICE')) {
        errorMessage =
          'No active Spotify device found. Open Spotify on a device first.';
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
