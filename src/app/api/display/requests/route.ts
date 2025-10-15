import { NextRequest, NextResponse } from 'next/server';
import { getRequestsByStatus } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Multi-tenant isolation - get username from query params
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Get user_id from username for multi-tenant isolation
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // Get approved requests for THIS user only (up to 10)
    const approvedRequests = await getRequestsByStatus('approved', 10, 0, userId);
    
    // Get recently played requests for THIS user only (up to 10)
    const recentlyPlayedRequests = await getRequestsByStatus('played', 10, 0, userId);
    
    return NextResponse.json({
      approved_requests: approvedRequests,
      recently_played_requests: recentlyPlayedRequests
    });
    
  } catch (error) {
    console.error('Error getting display requests:', error);
    return NextResponse.json({ 
      error: 'Failed to get display requests',
      approved_requests: [],
      recently_played_requests: []
    }, { status: 500 });
  }
}

