/**
 * User Lookup API Endpoint
 * 
 * Public endpoint to lookup a user's ID by username
 * Used by public pages to subscribe to user-specific Pusher channels
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ 
        error: 'Username is required' 
      }, { status: 400 });
    }

    console.log(`🔍 [users/lookup] Looking up userId for username: ${username}`);

    // Get user ID from username
    const result = await sql`
      SELECT id FROM users WHERE username = ${username} LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      userId: result[0].id,
      username: username
    });

  } catch (error) {
    console.error('❌ Error looking up user:', error);
    return NextResponse.json({ 
      error: 'Failed to lookup user' 
    }, { status: 500 });
  }
}

