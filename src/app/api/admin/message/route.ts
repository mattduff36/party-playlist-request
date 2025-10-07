import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getEventSettings, updateEventSettings } from '@/lib/db';
import { triggerEvent, CHANNELS } from '@/lib/pusher';

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

    // Update the message using the proper database function
    const updatedSettings = await updateEventSettings({
      message_text: message_text.trim(),
      message_duration,
      message_created_at: new Date()
    });

    console.log('✅ Message updated:', { message_text: message_text.trim(), message_duration });

    // Trigger Pusher event for real-time updates (same as page controls)
    try {
      await triggerEvent(CHANNELS.PARTY_PLAYLIST, 'message-update', {
        message_text: message_text.trim(),
        message_duration,
        message_created_at: updatedSettings.message_created_at?.toISOString() || new Date().toISOString()
      });
      console.log('📡 Pusher event sent for message update');
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
        message_created_at: updatedSettings.message_created_at?.toISOString() || new Date().toISOString()
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

    // Clear the message using the proper database function
    await updateEventSettings({
      message_text: null,
      message_duration: null,
      message_created_at: null
    });

    console.log('✅ Message cleared');

    // Trigger Pusher event for real-time updates (same as page controls)
    try {
      await triggerEvent(CHANNELS.PARTY_PLAYLIST, 'message-cleared', {
        cleared_at: new Date().toISOString()
      });
      console.log('📡 Pusher event sent for message cleared');
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
    // No auth required for getting messages (display page needs this)
    const settings = await getEventSettings();
    
    // Check if message has expired
    let isExpired = false;
    if (settings.message_text && settings.message_duration && settings.message_created_at) {
      const createdAt = new Date(settings.message_created_at);
      const expiresAt = new Date(createdAt.getTime() + (settings.message_duration * 1000));
      isExpired = new Date() > expiresAt;
    }

    // If expired, clear the message
    if (isExpired) {
      await updateEventSettings({
        message_text: null,
        message_duration: null,
        message_created_at: null
      });
      
      return NextResponse.json({
        message_text: null,
        message_duration: null,
        message_created_at: null,
        expired: true
      });
    }

    return NextResponse.json({
      message_text: settings.message_text || null,
      message_duration: settings.message_duration || null,
      message_created_at: settings.message_created_at?.toISOString() || null,
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
