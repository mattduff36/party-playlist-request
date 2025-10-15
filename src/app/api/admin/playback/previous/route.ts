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

    // Go to previous track
    await spotifyService.previous(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to go to previous track:', error);
    return NextResponse.json(
      { error: 'Failed to go to previous track' },
      { status: 500 }
    );
  }
}

