import { NextRequest, NextResponse } from 'next/server';
import { initializeDefaults, checkRecentDuplicate } from '@/lib/db';
import { spotifyService } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🧪 [${requestId}] DEBUG: Request test endpoint called`);
  const startTime = Date.now();
  
  try {
    // Test 1: Database initialization
    console.log(`⏱️ [${requestId}] Testing database initialization...`);
    const dbStart = Date.now();
    await initializeDefaults();
    const dbTime = Date.now() - dbStart;
    console.log(`✅ [${requestId}] Database init completed: ${dbTime}ms`);

    // Test 2: Simple database query
    console.log(`⏱️ [${requestId}] Testing duplicate check query...`);
    const queryStart = Date.now();
    await checkRecentDuplicate('spotify:track:test123', 30);
    const queryTime = Date.now() - queryStart;
    console.log(`✅ [${requestId}] Duplicate check completed: ${queryTime}ms`);

    // Test 3: Spotify service connection (without actual API call)
    console.log(`⏱️ [${requestId}] Testing Spotify service connection...`);
    const spotifyStart = Date.now();
    const isConnected = await spotifyService.isConnected();
    const spotifyTime = Date.now() - spotifyStart;
    console.log(`✅ [${requestId}] Spotify check completed: ${spotifyTime}ms, isConnected: ${isConnected}`);

    const totalTime = Date.now() - startTime;
    console.log(`🎯 [${requestId}] All tests completed: ${totalTime}ms total`);

    return NextResponse.json({
      success: true,
      requestId,
      timing: {
        database_init: `${dbTime}ms`,
        duplicate_check: `${queryTime}ms`,
        spotify_check: `${spotifyTime}ms`,
        total: `${totalTime}ms`
      },
      spotify_status: {
        is_connected: isConnected
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] DEBUG test failed after ${totalTime}ms:`, error);
    return NextResponse.json({ 
      error: 'Debug test failed',
      requestId,
      timing: {
        total: `${totalTime}ms`
      },
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
