import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getRequestsByStatus, getAllRequests, getRequestsCount } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let requests;
    let total;

    if (status === 'all') {
      requests = await getAllRequests(limit, offset);
      const counts = await getRequestsCount();
      total = counts.total;
    } else {
      requests = await getRequestsByStatus(status, limit, offset);
      const counts = await getRequestsCount();
      total = status === 'pending' ? counts.pending : 
             status === 'approved' ? counts.approved : 
             status === 'rejected' ? counts.rejected : 0;
    }

    return NextResponse.json({
      requests,
      pagination: {
        total,
        limit,
        offset,
        has_more: total > offset + limit
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error getting requests:', error);
    return NextResponse.json({ 
      error: 'Failed to get requests' 
    }, { status: 500 });
  }
}