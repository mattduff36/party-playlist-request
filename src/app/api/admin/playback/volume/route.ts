import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { verifyJWT } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Verify JWT authentication
    const authResult = verifyJWT(req);
    if (!authResult.valid || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user.user_id;
    const { volume } = await req.json();

    // Validate volume is between 0 and 100
    const volumePercent = Math.max(0, Math.min(100, parseInt(volume)));

    // Set volume
    await spotifyService.setVolume(volumePercent, userId);

    return NextResponse.json({ success: true, volume: volumePercent });
  } catch (error) {
    console.error('Failed to set volume:', error);
    return NextResponse.json(
      { error: 'Failed to set volume' },
      { status: 500 }
    );
  }
}

