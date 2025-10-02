import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    console.log('Initializing database...');
    
    // Create a default event to initialize the database
    const event = await dbService.createEvent({
      status: 'offline',
      version: 0,
      config: {
        pages_enabled: {
          requests: false,
          display: false,
        },
        event_title: 'Party DJ Requests',
        welcome_message: 'Welcome to the party!',
        secondary_message: 'Request your favorite songs',
        tertiary_message: 'Have fun!',
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      event: event
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ 
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

