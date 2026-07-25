import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getEventSettings, updateEventSettings, initializeDefaults } from '@/lib/db';
import { triggerEvent, getUserChannel } from '@/lib/pusher';
import { reportActivity, reportApiError } from '@/lib/support/withApiLogging';

export async function GET(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }

    await initializeDefaults();
    
    const userId = auth.user.user_id;
    console.log(`⚙️ [admin/event-settings] User ${auth.user.username} (${userId}) fetching settings`);
    
    const settings = await getEventSettings(userId);
    
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error getting event settings:', error);
    return NextResponse.json({ 
      error: 'Failed to get event settings' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate and get user info
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.user) {
      return auth.response!;
    }
    
    await initializeDefaults();

    const userId = auth.user.user_id;
    console.log(`⚙️ [admin/event-settings] User ${auth.user.username} (${userId}) updating settings`);
    
    const body = await req.json();
    const {
      event_title,
      dj_name,
      venue_info,
      welcome_message,
      secondary_message,
      tertiary_message,
      show_qr_code,
      display_refresh_interval,
      request_limit,
      auto_approve,
      force_polling,
      decline_explicit,
      qr_boost_duration,
      display_mood,
      theme_primary_color,
      theme_secondary_color,
      theme_tertiary_color,
      show_scrolling_bar,
      karaoke_mode,
      show_approval_messages
    } = body;

    const allowedMoods = new Set(['club', 'venue', 'dj']);
    const safeMood =
      typeof display_mood === 'string' && allowedMoods.has(display_mood)
        ? display_mood
        : undefined;
    
    console.log('📝 Updating event settings:', {
      event_title,
      request_limit,
      auto_approve,
      force_polling,
      decline_explicit,
      show_scrolling_bar,
      karaoke_mode,
      qr_boost_duration,
      display_mood: safeMood,
      welcome_message,
      secondary_message,
      tertiary_message,
      show_qr_code,
      hasOtherFields: !!(dj_name || venue_info)
    });
    
    const updatedSettings = await updateEventSettings({
      event_title,
      dj_name,
      venue_info,
      welcome_message,
      secondary_message,
      tertiary_message,
      show_qr_code,
      display_refresh_interval,
      request_limit,
      auto_approve,
      force_polling,
      decline_explicit,
      qr_boost_duration,
      ...(safeMood ? { display_mood: safeMood as 'club' | 'venue' | 'dj' } : {}),
      theme_primary_color,
      theme_secondary_color,
      theme_tertiary_color,
      show_scrolling_bar,
      karaoke_mode,
      show_approval_messages
    }, userId);
    
    // Trigger Pusher event to notify all clients of settings update (USER-SPECIFIC CHANNEL)
    try {
      const userChannel = getUserChannel(userId);
      await triggerEvent(userChannel, 'settings-update', {
        settings: updatedSettings,
        timestamp: Date.now(),
        userId
      });
      console.log(`📡 Settings update event sent via Pusher to ${userChannel}`);
    } catch (pusherError) {
      console.error('Failed to send Pusher event for settings update:', pusherError);
      // Don't fail the request if Pusher fails
    }
    
    reportActivity(req, 'settings.update', `Settings updated by ${auth.user.username}`, {
      user: auth.user,
      meta: {
        display_mood: safeMood,
        event_title,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error updating event settings:', error);
    reportApiError(req, error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Failed to update event settings',
      detail,
    }, { status: 500 });
  }
}
