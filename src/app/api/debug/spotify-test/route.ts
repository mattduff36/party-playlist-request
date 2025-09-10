import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🧪 [${requestId}] DEBUG: Spotify API test endpoint called`);
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { trackUri = 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh' } = body; // Default to a popular song

    // Test 1: Check connection
    console.log(`⏱️ [${requestId}] Testing Spotify connection...`);
    const connectionStart = Date.now();
    const isConnected = await spotifyService.isConnected();
    const connectionTime = Date.now() - connectionStart;
    console.log(`✅ [${requestId}] Connection check: ${connectionTime}ms, connected: ${isConnected}`);

    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'Spotify not connected',
        requestId,
        timing: {
          connection_check: `${connectionTime}ms`,
          total: `${Date.now() - startTime}ms`
        }
      }, { status: 400 });
    }

    // Test 2: Get track info (this is what the request endpoint does)
    console.log(`⏱️ [${requestId}] Testing getTrack API call...`);
    const trackStart = Date.now();
    try {
      const trackInfo = await spotifyService.getTrack(trackUri);
      const trackTime = Date.now() - trackStart;
      console.log(`✅ [${requestId}] getTrack completed: ${trackTime}ms`);

      const totalTime = Date.now() - startTime;
      console.log(`🎯 [${requestId}] All Spotify tests completed: ${totalTime}ms total`);

      return NextResponse.json({
        success: true,
        requestId,
        timing: {
          connection_check: `${connectionTime}ms`,
          get_track: `${trackTime}ms`,
          total: `${totalTime}ms`
        },
        track_info: {
          name: trackInfo.name,
          artists: trackInfo.artists,
          album: trackInfo.album
        }
      });

    } catch (trackError) {
      const trackTime = Date.now() - trackStart;
      console.error(`❌ [${requestId}] getTrack failed after ${trackTime}ms:`, trackError);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to get track info',
        requestId,
        timing: {
          connection_check: `${connectionTime}ms`,
          get_track_failed: `${trackTime}ms`,
          total: `${Date.now() - startTime}ms`
        },
        details: trackError instanceof Error ? trackError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] Spotify test failed after ${totalTime}ms:`, error);
    return NextResponse.json({ 
      error: 'Spotify test failed',
      requestId,
      timing: {
        total: `${totalTime}ms`
      },
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
