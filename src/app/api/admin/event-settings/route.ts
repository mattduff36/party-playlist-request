import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getEventSettings, updateEventSettings } from '@/lib/db';
import { triggerEvent, CHANNELS } from '@/lib/pusher';

export async function GET(req: NextRequest) {
  try {
    await authService.requireAdminAuth(req);
    
    const settings = await getEventSettings();
    
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
    await authService.requireAdminAuth(req);
    
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
      theme_primary_color,
      theme_secondary_color,
      theme_tertiary_color,
      show_scrolling_bar,
      karaoke_mode
    } = body;
    
    console.log('📝 Updating event settings:', {
      event_title,
      request_limit,
      auto_approve,
      force_polling,
      decline_explicit,
      show_scrolling_bar,
      karaoke_mode,
      qr_boost_duration,
      theme_primary_color,
      theme_secondary_color,
      theme_tertiary_color,
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
      theme_primary_color,
      theme_secondary_color,
      theme_tertiary_color,
      show_scrolling_bar,
      karaoke_mode
    });
    
    // Trigger Pusher event to notify all clients of settings update
    try {
      await triggerEvent(CHANNELS.PARTY_PLAYLIST, 'settings-update', {
        settings: updatedSettings,
        timestamp: Date.now()
      });
      console.log('📡 Settings update event sent via Pusher');
    } catch (pusherError) {
      console.error('Failed to send Pusher event for settings update:', pusherError);
      // Don't fail the request if Pusher fails
    }
    
    return NextResponse.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('token')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error('Error updating event settings:', error);
    return NextResponse.json({ 
      error: 'Failed to update event settings' 
    }, { status: 500 });
  }
}
