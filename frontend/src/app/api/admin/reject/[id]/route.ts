import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getRequest, updateRequest } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await authService.requireAdminAuth(req);
    const { id } = params;
    
    const body = await req.json();
    const { reason } = body;
    
    const request = await getRequest(id);

    if (!request || request.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Request not found or already processed' 
      }, { status: 404 });
    }

    await updateRequest(id, {
      status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: admin.username,
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