import { NextRequest, NextResponse } from 'next/server';
import { initializeDefaults } from '@/lib/db';

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🧪 [${requestId}] SIMPLE DEBUG: Test endpoint called`);
  const startTime = Date.now();
  
  try {
    // Test 1: Database initialization only
    console.log(`⏱️ [${requestId}] Testing database initialization...`);
    const dbStart = Date.now();
    await initializeDefaults();
    const dbTime = Date.now() - dbStart;
    console.log(`✅ [${requestId}] Database init completed: ${dbTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`🎯 [${requestId}] Simple test completed: ${totalTime}ms total`);

    return NextResponse.json({
      success: true,
      requestId,
      timing: {
        database_init: `${dbTime}ms`,
        total: `${totalTime}ms`
      },
      message: "Simple database test successful"
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] Simple test failed after ${totalTime}ms:`, error);
    return NextResponse.json({ 
      error: 'Simple test failed',
      requestId,
      timing: {
        total: `${totalTime}ms`
      },
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
