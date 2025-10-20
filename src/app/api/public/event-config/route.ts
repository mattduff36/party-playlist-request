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

    // Get message data from events.config (not user_settings)
    // Message queue writes to events.config JSONB field for real-time updates
    const { sql } = await import('@/lib/db/neon-client');
    const eventResult = await sql`
      SELECT config FROM events WHERE user_id = ${userId} LIMIT 1
    `;
    
    const eventConfig = eventResult.length > 0 ? eventResult[0].config : {};
    const messageText = (eventConfig as any)?.message_text || null;
    const messageDuration = (eventConfig as any)?.message_duration || null;
    const messageCreatedAt = (eventConfig as any)?.message_created_at || null;

    // Include all display-relevant settings
    return NextResponse.json({
      config: {
        event_title: settings.event_title || 'Party DJ Requests',
        welcome_message: settings.welcome_message || 'Request your favorite songs!',
        secondary_message: settings.secondary_message || 'Your requests will be reviewed by the DJ',
        tertiary_message: settings.tertiary_message || 'Keep the party going!',
        theme_primary_color: (settings as any).theme_primary_color || '#1DB954',
        theme_secondary_color: (settings as any).theme_secondary_color || '#191414',
        theme_tertiary_color: (settings as any).theme_tertiary_color || '#1ed760',
        show_approval_messages: (settings as any).show_approval_messages ?? false,
        show_scrolling_bar: (settings as any).show_scrolling_bar ?? true,
        qr_boost_duration: (settings as any).qr_boost_duration || 5,
        message_text: messageText,
        message_duration: messageDuration,
        message_created_at: messageCreatedAt,
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
          theme_primary_color: '#1DB954',
          theme_secondary_color: '#191414',
          theme_tertiary_color: '#1ed760',
          show_approval_messages: false,
          show_scrolling_bar: true,
          qr_boost_duration: 5,
        }
      },
      { status: 200 } // Return defaults instead of error for graceful degradation
    );
  }
}

