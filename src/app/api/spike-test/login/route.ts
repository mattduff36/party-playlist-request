/**
 * Spike 2 Test: Login Endpoint
 * Purpose: Generate JWT tokens for test users
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateToken, TEST_USERS, comparePassword, benchmarkStart, benchmarkEnd } from '@/lib/auth-spike';

export async function POST(req: NextRequest) {
  const start = benchmarkStart();
  
  try {
    const body = await req.json();
    const { username, password } = body;
    
    console.log('🔐 [Spike Test] Login attempt for:', username);
    
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      );
    }
    
    // Find test user
    const testUser = Object.values(TEST_USERS).find(u => u.username === username);
    
    if (!testUser) {
      console.log('❌ [Spike Test] User not found:', username);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // For spike testing, simple password comparison
    // In production, would use comparePassword with hashed passwords
    if (password !== testUser.password) {
      console.log('❌ [Spike Test] Invalid password for:', username);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate JWT
    const token = generateToken({
      user_id: testUser.user_id,
      username: testUser.username,
      email: testUser.email,
      role: testUser.role
    });
    
    const duration = benchmarkEnd(start, 'Login');
    
    console.log('✅ [Spike Test] Login successful for:', username);
    
    // Return token in response and set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        user_id: testUser.user_id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      },
      token,
      performance_ms: duration
    });
    
    // Set HTTP-only cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    return response;
    
  } catch (error) {
    console.error('❌ [Spike Test] Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
