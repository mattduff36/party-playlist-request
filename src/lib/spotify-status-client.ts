/**
 * Client-Safe Spotify Connection Status Manager
 * 
 * This module provides client-side functions for managing Spotify connection status
 * without importing any server-side dependencies.
 */

// Global connection status cache (client-side only)
let cachedConnectionStatus: boolean | null = null;
let lastStatusCheck = 0;
const STATUS_CACHE_DURATION = 30000; // 30 seconds

/**
 * Get Spotify connection status for client-side usage
 * Makes an API call to get the status from the server
 */
export async function getSpotifyConnectionStatusClient(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.spotify_connected || false;
    }
    
    return false;
  } catch (error) {
    console.error('❌ SpotifyStatus: Error checking connection from client:', error);
    return false;
  }
}

/**
 * Get cached connection status without making API calls (client-side)
 * Returns null if no cached status is available
 */
export function getCachedSpotifyConnectionStatus(): boolean | null {
  const now = Date.now();
  
  // Return cached status only if it's still fresh
  if (cachedConnectionStatus !== null && (now - lastStatusCheck) < STATUS_CACHE_DURATION) {
    return cachedConnectionStatus;
  }
  
  return null;
}

/**
 * Mark Spotify as disconnected (client-side)
 * This function is safe to call from client-side code
 */
export function markSpotifyDisconnected(): void {
  console.log('🔄 SpotifyStatus: Marking Spotify as disconnected (client-side)');
  cachedConnectionStatus = false;
  lastStatusCheck = Date.now();
}
