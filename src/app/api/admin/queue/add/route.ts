import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getSetting } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

function collectTrackUris(body: {
  track_uri?: unknown;
  track_uris?: unknown;
}): string[] {
  const uris: string[] = [];

  if (typeof body?.track_uri === 'string' && body.track_uri.trim()) {
    uris.push(body.track_uri.trim());
  }

  if (Array.isArray(body?.track_uris)) {
    for (const uri of body.track_uris) {
      if (typeof uri === 'string' && uri.trim()) {
        uris.push(uri.trim());
      }
    }
  }

  return [...new Set(uris)].filter((uri) => uri.startsWith('spotify:track:'));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🎵 [queue/add] User ${auth.user.username} (${userId}) adding to queue`);

    const body = await req.json();
    const { position = 'bottom', device_id } = body;
    const trackUris = collectTrackUris(body);

    if (trackUris.length === 0) {
      return NextResponse.json(
        { error: 'track_uri or track_uris is required' },
        { status: 400 }
      );
    }

    if (trackUris.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 tracks per request' },
        { status: 400 }
      );
    }

    const deviceId =
      typeof device_id === 'string' && device_id.trim()
        ? device_id.trim()
        : (await getSetting('target_device_id')) || undefined;

    let queued = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const trackUri of trackUris) {
      try {
        await spotifyService.addToQueue(trackUri, deviceId || undefined, userId);
        queued += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < 5) {
          errors.push(
            error instanceof Error ? error.message : `Failed to queue ${trackUri}`
          );
        }
      }
    }

    return NextResponse.json({
      success: queued > 0,
      message:
        trackUris.length === 1
          ? `Track added to ${position} of queue`
          : `Queued ${queued} of ${trackUris.length} tracks`,
      position,
      queued,
      failed,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: 'Failed to add track to queue' },
      { status: 500 }
    );
  }
}
