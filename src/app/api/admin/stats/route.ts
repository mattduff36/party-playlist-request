import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getRequestsCount, getAllRequests } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    const userId = auth.user.user_id;
    console.log(`📊 [admin/stats] User ${auth.user.username} (${userId}) fetching stats`);
    
    // Now user-scoped! Only count this user's requests
    const counts = await getRequestsCount(userId);
    const allRequests = await getAllRequests(1000, 0, userId); // Get more for stats
    
    // Calculate today's requests
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRequests = allRequests.filter(r => 
      new Date(r.created_at).getTime() >= today.getTime()
    ).length;

    // Calculate recent requests (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentRequests = allRequests.filter(r => 
      new Date(r.created_at).getTime() > oneHourAgo
    ).length;

    // Get top artists (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentRequestsForArtists = allRequests.filter(r => 
      new Date(r.created_at).getTime() > sevenDaysAgo
    );

    const artistCounts: { [key: string]: number } = {};
    recentRequestsForArtists.forEach(r => {
      artistCounts[r.artist_name] = (artistCounts[r.artist_name] || 0) + 1;
    });

    const topArtists = Object.entries(artistCounts)
      .map(([artist_name, request_count]) => ({ artist_name, request_count }))
      .sort((a, b) => b.request_count - a.request_count)
      .slice(0, 10);

    const spotifyConnected = await spotifyService.isConnectedAndValid(userId);

    const response = NextResponse.json({
      total_requests: counts.total,
      pending_requests: counts.pending,
      approved_requests: counts.approved,
      rejected_requests: counts.rejected,
      today_requests: todayRequests,
      recent_requests: recentRequests,
      top_artists: topArtists,
      spotify_connected: spotifyConnected
    });
    
    // OPTIMIZATION: Add cache headers (20 seconds - stats are aggregated and change slowly)
    response.headers.set('Cache-Control', 'private, max-age=20, stale-while-revalidate=40');
    
    return response;

  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error getting stats:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    return NextResponse.json({ 
      error: 'Failed to get statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}