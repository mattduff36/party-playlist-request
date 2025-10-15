import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequestsByStatus, getAllRequests, getRequestsCount } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`🔍 [admin/requests] User ${auth.user.username} (${userId}) fetching requests`);
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let requests;
    let total;

    // Now user-scoped! Only return this user's requests
    if (status === 'all') {
      requests = await getAllRequests(limit, offset, userId);
      const counts = await getRequestsCount(userId);
      total = counts.total;
    } else {
      requests = await getRequestsByStatus(status, limit, offset, userId);
      const counts = await getRequestsCount(userId);
      total = status === 'pending' ? counts.pending : 
             status === 'approved' ? counts.approved : 
             status === 'rejected' ? counts.rejected : 0;
    }

    const response = NextResponse.json({
      requests,
      pagination: {
        total,
        limit,
        offset,
        has_more: total > offset + limit
      }
    });
    
    // OPTIMIZATION: Add cache headers (15 seconds - requests change frequently but not constantly)
    response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    
    return response;

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