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
    
    console.log(`❌ [admin/reject] User ${auth.user.username} (${userId}) rejecting request ${id}`);
    
    const body = await req.json();
    const { reason } = body;
    
    // Verify ownership - user can only reject their own requests
    const request = await getRequest(id, userId);
    
    if (!request) {
      console.log(`❌ [admin/reject] Request ${id} not found or not owned by user ${userId}`);
      return NextResponse.json({ 
        error: 'Request not found or access denied' 
      }, { status: 404 });
    }

    if (!request || request.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Request not found or already processed' 
      }, { status: 404 });
    }

    await updateRequest(id, {
      status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: auth.user.username,
      rejection_reason: reason || 'No reason provided'
    });

    return NextResponse.json({
      success: true,
      message: 'Request rejected successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error rejecting request:', error);
    return NextResponse.json({ 
      error: 'Failed to reject request' 
    }, { status: 500 });
  }
}