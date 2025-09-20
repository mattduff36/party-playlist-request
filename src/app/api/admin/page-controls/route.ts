import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getEventSettings, updateEventSettings } from '@/lib/db';
import { triggerEvent, CHANNELS, EVENTS } from '@/lib/pusher';

export async function GET(req: NextRequest) {
  try {
    // Require admin authentication
    await authService.requireAdminAuth(req);
    
    const settings = await getEventSettings();
    
    return NextResponse.json({
      requests_page_enabled: settings.requests_page_enabled ?? false,
      display_page_enabled: settings.display_page_enabled ?? false
    });
    
  } catch (error) {
    console.error('Error getting page controls:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { 
        error: 'Failed to get page controls',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Require admin authentication
    await authService.requireAdminAuth(req);
    
    const body = await req.json();
    const { requests_page_enabled, display_page_enabled } = body;
    
    // Validate input
    if (typeof requests_page_enabled !== 'boolean' && typeof display_page_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'At least one page control setting must be provided' },
        { status: 400 }
      );
    }
    
    // Update settings
    const updateData: any = {};
    if (typeof requests_page_enabled === 'boolean') {
      updateData.requests_page_enabled = requests_page_enabled;
    }
    if (typeof display_page_enabled === 'boolean') {
      updateData.display_page_enabled = display_page_enabled;
    }
    
    const updatedSettings = await updateEventSettings(updateData);
    
    // Trigger Pusher event for cross-device communication
    await triggerEvent(CHANNELS.PARTY_PLAYLIST, EVENTS.PAGE_CONTROL_TOGGLE, {
      requests_page_enabled: updatedSettings.requests_page_enabled,
      display_page_enabled: updatedSettings.display_page_enabled,
      timestamp: Date.now()
    });
    
    console.log('📡 Pusher event sent: page-control-toggle', {
      requests_page_enabled: updatedSettings.requests_page_enabled,
      display_page_enabled: updatedSettings.display_page_enabled
    });
    
    return NextResponse.json({
      success: true,
      message: 'Page controls updated successfully',
      settings: {
        requests_page_enabled: updatedSettings.requests_page_enabled,
        display_page_enabled: updatedSettings.display_page_enabled
      }
    });
    
  } catch (error) {
    console.error('Error updating page controls:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to update page controls',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
