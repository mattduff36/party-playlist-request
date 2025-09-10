import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { initializeDefaults } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await initializeDefaults();
    
    const body = await req.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Username and password are required' 
      }, { status: 400 });
    }

    const authResult = await authService.authenticateAdmin(username, password);
    
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token: authResult.token,
      admin: authResult.admin
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ 
      error: 'Invalid credentials' 
    }, { status: 401 });
  }
}