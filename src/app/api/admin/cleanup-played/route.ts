import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`🧹 [cleanup-played] User ${auth.user.username} (${userId}) cleaning up played requests`);
    
    const client = getPool();
    
    // Delete played requests that are older than 1 hour (user-scoped)
    const result = await client.query(`
      DELETE FROM requests 
      WHERE status = 'played' 
      AND user_id = $1
      AND approved_at < NOW() - INTERVAL '1 hour'
      RETURNING id, track_name, artist_name, approved_at
    `, [userId]);
    
    const deletedRequests = result.rows;
    
    if (deletedRequests.length > 0) {
      console.log(`🧹 Auto-deleted ${deletedRequests.length} played requests older than 1 hour:`);
      deletedRequests.forEach(req => {
        console.log(`  - ${req.track_name} by ${req.artist_name} (played at ${req.approved_at})`);
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedRequests.length} played requests`,
      deleted_count: deletedRequests.length,
      deleted_requests: deletedRequests.map(req => ({
        id: req.id,
        track_name: req.track_name,
        artist_name: req.artist_name,
        played_at: req.approved_at
      }))
    });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error cleaning up played requests:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup played requests' 
    }, { status: 500 });
  }
}
