import { NextRequest, NextResponse } from 'next/server';

// Track if startup has been called
let startupComplete = false;

export async function POST(req: NextRequest) {
  // Only run startup once per server instance
  if (startupComplete) {
    return NextResponse.json({ 
      success: true, 
      message: 'Startup already completed' 
    });
  }

  try {
    console.log('🚀 Running server startup tasks...');

    // Start Spotify watcher for real-time display updates
    // This ensures the display page gets updates even when no admin is logged in
    try {
      const watcherResponse = await fetch(`${req.nextUrl.origin}/api/admin/spotify-watcher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Use a system token for internal startup calls
          'Authorization': `Bearer ${process.env.SYSTEM_STARTUP_TOKEN || 'startup-system-token'}`
        },
        body: JSON.stringify({ 
          action: 'start', 
          interval: 5000 
        })
      });

      if (watcherResponse.ok) {
        console.log('✅ Spotify watcher started on server startup');
      } else {
        console.warn('⚠️ Could not start Spotify watcher on startup:', await watcherResponse.text());
      }
    } catch (error) {
      console.warn('⚠️ Spotify watcher startup failed:', error);
    }

    startupComplete = true;
    console.log('✅ Server startup tasks completed');

    return NextResponse.json({ 
      success: true, 
      message: 'Server startup completed successfully' 
    });

  } catch (error) {
    console.error('❌ Server startup error:', error);
    return NextResponse.json({ 
      error: 'Server startup failed' 
    }, { status: 500 });
  }
}

// Allow GET requests to check startup status
export async function GET() {
  return NextResponse.json({ 
    startupComplete,
    timestamp: Date.now()
  });
}
