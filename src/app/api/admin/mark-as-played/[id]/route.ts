import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getRequest, updateRequest } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await authService.requireAdminAuth(req);
    const { id } = await params;
    
    const request = await getRequest(id);

    if (!request) {
      return NextResponse.json({ 
        error: 'Request not found' 
      }, { status: 404 });
    }

    if (request.status !== 'approved') {
      return NextResponse.json({ 
        error: 'Only approved requests can be marked as played' 
      }, { status: 400 });
    }

    await updateRequest(id, {
      status: 'played',
      approved_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Request marked as played',
      request: {
        id: request.id,
        track_name: request.track_name,
        artist_name: request.artist_name,
        status: 'played'
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error marking request as played:', error);
    return NextResponse.json({ 
      error: 'Failed to mark request as played' 
    }, { status: 500 });
  }
}
