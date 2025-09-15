import { NextRequest } from 'next/server';

// Server-Sent Events endpoint for real-time updates (Vercel-compatible)
export async function GET(req: NextRequest) {
  try {
    // Get token from query params since EventSource doesn't support custom headers
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response('No token provided', { status: 401 });
    }
    
    // Verify the token manually
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      if (!decoded || decoded.username !== 'admin') {
        return new Response('Invalid token', { status: 401 });
      }
    } catch (error) {
      return new Response('Invalid token', { status: 401 });
    }

    // Set up SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

        // Set up periodic updates (every 5 seconds for production)
        const interval = setInterval(async () => {
          try {
            // Fetch latest admin data
            const { getAllRequests, getEventSettings } = await import('@/lib/db');
            const { SpotifyService } = await import('@/lib/spotify');
            
            const [requests, eventSettings] = await Promise.all([
              getAllRequests(50, 0).catch(() => []),
              getEventSettings().catch(() => null)
            ]);

            // Get Spotify state if available
            let spotifyState = null;
            try {
              const spotifyService = new SpotifyService();
              const [currentPlayback, queue] = await Promise.all([
                spotifyService.getCurrentPlayback(),
                spotifyService.getQueue()
              ]);
              
              if (currentPlayback && currentPlayback.item) {
                spotifyState = {
                  current_track: currentPlayback.item,
                  queue: queue?.queue || [],
                  playback_state: currentPlayback,
                  is_playing: currentPlayback.is_playing,
                  progress_ms: currentPlayback.progress_ms,
                  timestamp: Date.now()
                };
              }
            } catch (error) {
              console.log('Spotify not available for SSE update');
            }

            // Calculate basic stats
            const stats = {
              total_requests: requests.length,
              pending_requests: requests.filter((r: any) => r.status === 'pending').length,
              approved_requests: requests.filter((r: any) => r.status === 'approved').length,
              rejected_requests: requests.filter((r: any) => r.status === 'rejected').length,
              played_requests: requests.filter((r: any) => r.status === 'played').length,
              unique_requesters: new Set(requests.map((r: any) => r.requester_nickname || 'Anonymous')).size,
              spotify_connected: !!spotifyState
            };

            const updateData = {
              requests,
              spotify_state: spotifyState,
              event_settings: eventSettings,
              stats
            };

            controller.enqueue(`data: ${JSON.stringify(updateData)}\n\n`);
          } catch (error) {
            console.error('SSE update error:', error);
            controller.enqueue(`data: ${JSON.stringify({ type: 'error', message: 'Update failed', timestamp: Date.now() })}\n\n`);
          }
        }, 5000); // 5 second updates for production

        // Cleanup on close
        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      }
    });

    return new Response(stream, { headers });
  } catch (error) {
    console.error('SSE endpoint error:', error);
    return new Response('Unauthorized', { status: 401 });
  }
}
