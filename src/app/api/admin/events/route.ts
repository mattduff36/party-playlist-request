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

        // Send periodic updates with configurable intervals to avoid Vercel timeout
        let updateCount = 0;
        let sseUpdateInterval = 3; // Default 3 seconds
        let maxUpdates = 10; // Default to 10 updates
        
        const sendUpdate = async () => {
          try {
            // Fetch latest admin data
            const { getAllRequests, getEventSettings } = await import('@/lib/db');
            const { SpotifyService } = await import('@/lib/spotify');
            
            const [requests, eventSettings] = await Promise.all([
              getAllRequests(50, 0).catch(() => []),
              getEventSettings().catch(() => null)
            ]);

            // Update SSE interval from settings (only on first update)
            if (updateCount === 0 && eventSettings?.sse_update_interval) {
              sseUpdateInterval = eventSettings.sse_update_interval;
              maxUpdates = Math.floor(30 / sseUpdateInterval); // Keep connections under 30 seconds
              console.log(`SSE using ${sseUpdateInterval}s intervals, max ${maxUpdates} updates`);
            }

            // Get Spotify state if available
            let spotifyState = null;
            try {
              const spotifyService = new SpotifyService();
              
              // Check if Spotify is connected first
              const isConnected = await spotifyService.isConnected();
              console.log(`SSE: Spotify connection status: ${isConnected}`);
              
              // In development mode, always try to get Spotify data (using mock APIs)
              const shouldTrySpotify = isConnected || process.env.NODE_ENV === 'development';
              console.log(`SSE: Should try Spotify APIs: ${shouldTrySpotify} (connected: ${isConnected}, dev: ${process.env.NODE_ENV === 'development'})`);
              
              // Debug: Get auth details for troubleshooting
              if (!isConnected) {
                try {
                  const { getSpotifyAuth } = await import('@/lib/db');
                  const auth = await getSpotifyAuth();
                  console.log('SSE: Auth debug:', {
                    hasAuth: !!auth,
                    hasAccessToken: !!(auth?.access_token),
                    hasRefreshToken: !!(auth?.refresh_token),
                    expiresAt: auth?.expires_at,
                    isExpired: auth?.expires_at ? new Date(auth.expires_at) < new Date() : 'no-expiry-date'
                  });
                } catch (debugError) {
                  console.log('SSE: Failed to get auth for debugging:', debugError.message);
                }
              }
              
              if (shouldTrySpotify) {
                const [currentPlayback, queue] = await Promise.all([
                  spotifyService.getCurrentPlayback().catch(e => {
                    console.log('SSE: Failed to get current playback:', e.message);
                    return null;
                  }),
                  spotifyService.getQueue().catch(e => {
                    console.log('SSE: Failed to get queue:', e.message);
                    return null;
                  })
                ]);
                
                console.log(`SSE: Playback data - has item: ${!!currentPlayback?.item}, is_playing: ${currentPlayback?.is_playing}`);
                
                if (currentPlayback && currentPlayback.item) {
                  spotifyState = {
                    current_track: currentPlayback.item,
                    queue: queue?.queue || [],
                    playback_state: currentPlayback,
                    is_playing: currentPlayback.is_playing,
                    progress_ms: currentPlayback.progress_ms,
                    timestamp: Date.now()
                  };
                  console.log(`SSE: Created Spotify state for track: ${currentPlayback.item.name}`);
                } else {
                  console.log('SSE: No current playback or track item');
                }
              } else {
                console.log('SSE: Spotify not connected');
              }
            } catch (error) {
              console.log('SSE: Spotify error:', error.message);
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
            updateCount++;
            
            // Schedule next update or close connection
            if (updateCount < maxUpdates) {
              setTimeout(sendUpdate, sseUpdateInterval * 1000); // Use configurable interval
            } else {
              // Send close signal and let client reconnect
              controller.enqueue(`data: ${JSON.stringify({ type: 'reconnect', message: 'Connection refresh needed' })}\n\n`);
              setTimeout(() => controller.close(), 1000);
            }
          } catch (error) {
            console.error('SSE update error:', error);
            controller.enqueue(`data: ${JSON.stringify({ type: 'error', message: 'Update failed', timestamp: Date.now() })}\n\n`);
          }
        };
        
        // Start sending updates
        setTimeout(sendUpdate, 1000); // First update after 1 second

        // Cleanup on close
        req.signal.addEventListener('abort', () => {
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
