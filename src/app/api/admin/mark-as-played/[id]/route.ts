import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequest, updateRequest } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    const { id } = await params;
    
    console.log(`✅ [admin/mark-as-played] User ${auth.user.username} (${userId}) marking request ${id} as played`);
    
    // Verify ownership - user can only mark their own requests as played
    const request = await getRequest(id, userId);

    if (!request) {
      console.log(`❌ [admin/mark-as-played] Request ${id} not found or not owned by user ${userId}`);
      return NextResponse.json({ 
        error: 'Request not found or access denied' 
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
