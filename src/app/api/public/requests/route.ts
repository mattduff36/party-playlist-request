import { NextRequest, NextResponse } from 'next/server';
import { getRequestsByStatus, getAllRequests } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Get user_id from username
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

    // Get approved and pending requests for display
    const approved = await getRequestsByStatus('approved', 50, 0, userId);
    const pending = await getRequestsByStatus('pending', 50, 0, userId);

    // Combine and sort (approved first, then pending)
    const requests = [...approved, ...pending];

    return NextResponse.json({
      requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Error fetching public requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

