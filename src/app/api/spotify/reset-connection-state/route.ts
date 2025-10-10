/**
 * Spotify Connection State Reset API Route
 * 
 * Allows manual reset of connection state (e.g., after admin fixes Spotify credentials)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    // Note: Connection state tracking removed - Spotify service handles retries internally
    return NextResponse.json({
      success: true,
      message: 'Spotify connection managed automatically by service layer'
    });

  } catch (error) {
    console.error('Error in reset-connection-state:', error);
    return NextResponse.json({
      error: 'Failed to process request'
    }, { status: 500 });
  }
}

