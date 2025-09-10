import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { spotifyService } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  console.log('🧪 Spotify test endpoint called');
  
  try {
    await authService.requireAdminAuth(req);
    console.log(`✅ Admin auth verified (${Date.now() - startTime}ms)`);
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[]
    };
    
    // Test 1: Check if tokens exist
    console.log('🔍 Test 1: Checking token existence...');
    const testStart1 = Date.now();
    try {
      const isConnected = await spotifyService.isConnected();
      results.tests.push({
        name: 'Token Existence Check',
        success: true,
        result: isConnected,
        duration: Date.now() - testStart1
      });
      console.log(`✅ Token check: ${isConnected} (${Date.now() - testStart1}ms)`);
    } catch (error) {
      results.tests.push({
        name: 'Token Existence Check',
        success: false,
        error: (error as Error).message,
        duration: Date.now() - testStart1
      });
      console.log(`❌ Token check failed: ${(error as Error).message}`);
    }
    
    // Test 2: Simple API call - Get user profile (lightweight)
    console.log('🔍 Test 2: Testing basic Spotify API call...');
    const testStart2 = Date.now();
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${await spotifyService.getAccessToken()}`
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const userData = await response.json();
        results.tests.push({
          name: 'Basic API Call (/me)',
          success: true,
          result: { id: userData.id, display_name: userData.display_name },
          duration: Date.now() - testStart2
        });
        console.log(`✅ Basic API call successful (${Date.now() - testStart2}ms)`);
      } else {
        results.tests.push({
          name: 'Basic API Call (/me)',
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          duration: Date.now() - testStart2
        });
        console.log(`❌ Basic API call failed: ${response.status}`);
      }
    } catch (error) {
      results.tests.push({
        name: 'Basic API Call (/me)',
        success: false,
        error: (error as Error).message,
        duration: Date.now() - testStart2
      });
      console.log(`❌ Basic API call error: ${(error as Error).message}`);
    }
    
    // Test 3: Get current playback (the problematic call)
    console.log('🔍 Test 3: Testing current playback call...');
    const testStart3 = Date.now();
    try {
      const playback = await Promise.race([
        spotifyService.getCurrentPlayback(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 3 seconds')), 3000)
        )
      ]);
      
      results.tests.push({
        name: 'Current Playback',
        success: true,
        result: playback ? 'Has playback data' : 'No active playback',
        duration: Date.now() - testStart3
      });
      console.log(`✅ Playback call successful (${Date.now() - testStart3}ms)`);
    } catch (error) {
      results.tests.push({
        name: 'Current Playback',
        success: false,
        error: (error as Error).message,
        duration: Date.now() - testStart3
      });
      console.log(`❌ Playback call failed: ${(error as Error).message}`);
    }
    
    console.log(`🎯 Spotify test completed (${Date.now() - startTime}ms total)`);
    
    return NextResponse.json({
      success: true,
      message: 'Spotify connectivity test completed',
      total_duration: Date.now() - startTime,
      ...results
    });
    
  } catch (error) {
    console.error(`❌ Spotify test failed (${Date.now() - startTime}ms):`, error);
    
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Spotify test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}
