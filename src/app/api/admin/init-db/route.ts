import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { initializeDatabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    console.log('🔧 Initializing database tables...');
    await initializeDatabase();
    console.log('✅ Database initialization completed');
    
    return NextResponse.json({
      success: true,
      message: 'Database tables initialized successfully'
    });
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    if (error instanceof Error && (error.message.includes('No token provided') || error.message.includes('Admin access required'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
