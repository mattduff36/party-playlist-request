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
      'playbackControls',
      'playback.resume'
    );
    if (refused) return refused;

    let device_id: string | undefined;
    try {
      const body = await req.json();
      device_id = body.device_id;
    } catch {
      device_id = undefined;
    }

    const result = await runProviderControl(userId, 'resume', {
      userId,
      deviceId: device_id,
    });

    if (!result.ok) {
      const status = result.code === 'CAPABILITY_NOT_SUPPORTED' ? 501 : 500;
      return NextResponse.json(
        { error: result.message || 'Failed to resume playback', code: result.code },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Playback resumed',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error resuming playback:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to resume playback',
      },
      { status: 500 }
    );
  }
}
