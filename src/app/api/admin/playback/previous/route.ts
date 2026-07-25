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

    let device_id: string | undefined;
    try {
      const body = await req.json();
      device_id = body.device_id;
    } catch {
      device_id = undefined;
    }

    await spotifyService.previous(device_id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to go to previous track:', error);
    let errorMessage = 'Failed to go to previous track';
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
