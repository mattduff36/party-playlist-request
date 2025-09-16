import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getEventSettings, updateEventSettings } from '@/lib/db';

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
      force_polling
    } = body;
    
    console.log('📝 Updating event settings:', {
      event_title,
      request_limit,
      auto_approve,
      force_polling,
      hasOtherFields: !!(dj_name || venue_info || welcome_message)
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
      force_polling
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
    return NextResponse.json({ 
      error: 'Failed to update event settings' 
    }, { status: 500 });
  }
}
