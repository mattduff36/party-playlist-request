import { NextRequest, NextResponse } from 'next/server';
import { getEventSettings } from '@/lib/db';
import { sql } from '@/lib/db/neon-client';

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

    // Get event config including message data (for Notice Board feature)
    const eventResult = await sql`
      SELECT config
      FROM events
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    let messageText = null;
    let messageDuration = null;
    let messageCreatedAt = null;
    let isExpired = false;

    if (eventResult.rows.length > 0) {
      const config = eventResult.rows[0].config as any;
      messageText = config?.message_text || null;
      messageDuration = config?.message_duration || null;
      messageCreatedAt = config?.message_created_at || null;

      // Check if message has expired
      if (messageText && messageDuration && messageCreatedAt) {
        const createdAt = new Date(messageCreatedAt);
        const expiresAt = new Date(createdAt.getTime() + (messageDuration * 1000));
        isExpired = new Date() > expiresAt;

        // If expired, don't return the message
        if (isExpired) {
          messageText = null;
          messageDuration = null;
          messageCreatedAt = null;
        }
      }
    }

    return NextResponse.json({
      config: {
        event_title: settings.event_title || 'Party DJ Requests',
        welcome_message: settings.welcome_message || 'Request your favorite songs!',
        secondary_message: settings.secondary_message || 'Your requests will be reviewed by the DJ',
        tertiary_message: settings.tertiary_message || 'Keep the party going!',
      },
      // Notice Board message data (approval messages)
      message_text: messageText,
      message_duration: messageDuration,
      message_created_at: messageCreatedAt,
      expired: isExpired
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
        },
        message_text: null,
        message_duration: null,
        message_created_at: null,
        expired: false
      },
      { status: 200 } // Return defaults instead of error for graceful degradation
    );
  }
}

