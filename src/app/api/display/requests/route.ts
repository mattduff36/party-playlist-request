import { NextRequest, NextResponse } from 'next/server';
import { getRequestsByStatus } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get approved requests (up to 10)
    const approvedRequests = await getRequestsByStatus('approved', 10);
    
    // Get recently played requests (up to 10)
    const recentlyPlayedRequests = await getRequestsByStatus('played', 10);
    
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

