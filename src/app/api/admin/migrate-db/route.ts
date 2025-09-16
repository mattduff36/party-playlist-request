import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { initializeDatabase } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
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
