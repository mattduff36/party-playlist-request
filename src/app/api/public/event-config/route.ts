import { NextRequest, NextResponse } from 'next/server';
import { getEventSettings } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Get user_id from username
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // Get user-specific event settings
    const settings = await getEventSettings(userId);

    return NextResponse.json({
      config: {
        event_title: settings.event_title || 'Party DJ Requests',
        welcome_message: settings.welcome_message || 'Request your favorite songs!',
        secondary_message: settings.secondary_message || 'Your requests will be reviewed by the DJ',
        tertiary_message: settings.tertiary_message || 'Keep the party going!',
      }
    });

  } catch (error) {
    console.error('Error fetching event config:', error);
    return NextResponse.json(
      { 
        config: {
          event_title: 'Party DJ Requests',
          welcome_message: 'Request your favorite songs!',
          secondary_message: 'Your requests will be reviewed by the DJ',
          tertiary_message: 'Keep the party going!',
        }
      },
      { status: 200 } // Return defaults instead of error for graceful degradation
    );
  }
}

