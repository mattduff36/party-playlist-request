import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { initializeDatabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    console.log('🔄 Running database migration...');
    await initializeDatabase();
    console.log('✅ Database migration completed');
    
    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
  } catch (error) {
    console.error('❌ Database migration error:', error);
    return NextResponse.json({ 
      error: 'Failed to run database migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
