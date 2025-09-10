import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const body = await req.json();
    const { device_id } = body;
    
    await spotifyService.skipToNext(device_id);
    
    return NextResponse.json({
      success: true,
      message: 'Skipped to next track'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error skipping track:', error);
    return NextResponse.json({ 
      error: 'Failed to skip track' 
    }, { status: 500 });
  }
}