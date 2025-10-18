import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { sql } from '@/lib/db/neon-client';
import { triggerEvent, getUserChannel } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`💬 [message] User ${auth.user.username} (${userId}) sending message`);

    const { message_text, message_duration } = await req.json();

    // Validate input
    if (!message_text || message_text.trim() === '') {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    if (message_duration !== null && (typeof message_duration !== 'number' || message_duration < 0)) {
      return NextResponse.json({ error: 'Invalid message duration' }, { status: 400 });
    }

    const messageCreatedAt = new Date().toISOString();

    // Update the user's event config with the message (MULTI-TENANT)
    await sql`
      UPDATE events
      SET config = jsonb_set(
            jsonb_set(
              jsonb_set(
                config,
                '{message_text}',
                to_jsonb(${message_text.trim()}::text)
              ),
              '{message_duration}',
              to_jsonb(${message_duration}::int)
            ),
            '{message_created_at}',
            to_jsonb(${messageCreatedAt}::text)
          ),
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    console.log('✅ Message updated:', { message_text: message_text.trim(), message_duration, userId });

    // Trigger Pusher event for real-time updates (USER-SPECIFIC CHANNEL)
    try {
      const userChannel = getUserChannel(userId);
      await triggerEvent(userChannel, 'message-update', {
        message_text: message_text.trim(),
        message_duration,
        message_created_at: messageCreatedAt,
        userId
      });
      console.log(`📡 Pusher event sent for message update to ${userChannel}`);
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: 'Message updated successfully',
      data: {
        message_text: message_text.trim(),
        message_duration,
        message_created_at: messageCreatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error updating message:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return NextResponse.json({ 
      error: 'Failed to update message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    const userId = auth.user.user_id;
    console.log(`💬 [message/delete] User ${auth.user.username} (${userId}) clearing message`);

    // Clear the message from user's event config (MULTI-TENANT)
    await sql`
      UPDATE events
      SET config = jsonb_set(
            jsonb_set(
              jsonb_set(
                config,
                '{message_text}',
                'null'::jsonb
              ),
              '{message_duration}',
              'null'::jsonb
            ),
            '{message_created_at}',
            'null'::jsonb
          ),
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    console.log('✅ Message cleared for user:', userId);

    // Trigger Pusher event for real-time updates (USER-SPECIFIC CHANNEL)
    try {
      const userChannel = getUserChannel(userId);
      await triggerEvent(userChannel, 'message-cleared', {
        cleared_at: new Date().toISOString(),
        userId
      });
      console.log(`📡 Pusher event sent for message cleared to ${userChannel}`);
    } catch (pusherError) {
      console.error('❌ Failed to send Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: 'Message cleared successfully'
    });

  } catch (error) {
    console.error('❌ Error clearing message:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return NextResponse.json({ 
      error: 'Failed to clear message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Extract username from query params for multi-tenant support
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    console.log(`📖 [message/get] Fetching message for user: ${username}`);

    // Get user's event config (MULTI-TENANT)
    const result = await sql`
      SELECT e.config
      FROM events e
      JOIN users u ON e.user_id = u.id
      WHERE u.username = ${username}
      LIMIT 1
    `;
    
    if (result.length === 0) {
      return NextResponse.json({
        message_text: null,
        message_duration: null,
        message_created_at: null,
        expired: false
      });
    }

    const config = (result[0] as any).config as any;
    const messageText = config?.message_text || null;
    const messageDuration = config?.message_duration || null;
    const messageCreatedAt = config?.message_created_at || null;

    // Check if message has expired
    let isExpired = false;
    if (messageText && messageDuration && messageCreatedAt) {
      const createdAt = new Date(messageCreatedAt);
      const expiresAt = new Date(createdAt.getTime() + (messageDuration * 1000));
      isExpired = new Date() > expiresAt;
    }

    // If expired, return null (don't auto-clear for now to avoid race conditions)
    if (isExpired) {
      return NextResponse.json({
        message_text: null,
        message_duration: null,
        message_created_at: null,
        expired: true
      });
    }

    return NextResponse.json({
      message_text: messageText,
      message_duration: messageDuration,
      message_created_at: messageCreatedAt,
      expired: false
    });

  } catch (error) {
    console.error('❌ Error getting message:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return NextResponse.json({ 
      error: 'Failed to get message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
