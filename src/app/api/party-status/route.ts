import { NextRequest, NextResponse } from 'next/server';
import { spotifyService } from '@/lib/spotify';
import { getAdmin, getEventSettings } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Check if Spotify is connected and valid
    const spotifyConnected = await spotifyService.isConnectedAndValid();
    
    // Check if there's at least one active admin (simplified check)
    // In a real scenario, you might want to check for active sessions
    let adminExists = false;
    try {
      // This is a simple check - you might want to implement a more sophisticated
      // session-based check depending on your requirements
      const testAdmin = await getAdmin('admin'); // Check if default admin exists
      adminExists = testAdmin && testAdmin.is_active;
    } catch (error) {
      adminExists = false;
    }
    
    // Get event settings to check manual page controls
    const eventSettings = await getEventSettings();
    const requestsPageEnabled = eventSettings.requests_page_enabled ?? false;
    const displayPageEnabled = eventSettings.display_page_enabled ?? false;
    
    // Party is active based only on manual page controls (ignore Spotify/admin status)
    const partyActive = requestsPageEnabled;
    
    return NextResponse.json({
      party_active: partyActive,
      spotify_connected: spotifyConnected,
      admin_available: adminExists,
      requests_page_enabled: requestsPageEnabled,
      display_page_enabled: displayPageEnabled,
      manual_override: !requestsPageEnabled || !displayPageEnabled
    });
    
  } catch (error) {
    console.error('Error checking party status:', error);
    return NextResponse.json({
      party_active: false,
      spotify_connected: false,
      admin_available: false,
      requests_page_enabled: false,
      display_page_enabled: false,
      manual_override: false
    });
  }
}
