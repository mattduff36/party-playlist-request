import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('Testing database connection...');
    
    // Import database service dynamically to avoid circular dependencies
    const { getDatabaseService } = await import('@/lib/db/database-service');
    const dbService = getDatabaseService();
    
    console.log('Database service created:', !!dbService);
    
    // Test basic connection using database service
    const event = await dbService.getEvent();
    console.log('Database test result:', event);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      event: event
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
