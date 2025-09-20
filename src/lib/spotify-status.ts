/**
 * Centralized Spotify Connection Status Manager
 * 
 * This module provides a single source of truth for Spotify connection status
 * across the entire application. All components and APIs should use this
 * instead of checking connection status independently.
 * 
 * NOTE: This module is designed to work in both server and client environments.
 * Server-side functions import spotifyService, client-side functions use API calls.
 */

// Global connection status cache
let cachedConnectionStatus: boolean | null = null;
let lastStatusCheck = 0;
const STATUS_CACHE_DURATION = 30000; // 30 seconds

/**
 * Get the current Spotify connection status with caching (SERVER-SIDE ONLY)
 * This is the single source of truth for connection status on the server
 */
export async function getSpotifyConnectionStatus(): Promise<boolean> {
  // Only import spotifyService on the server side
  if (typeof window !== 'undefined') {
    throw new Error('getSpotifyConnectionStatus() can only be called on the server side. Use getSpotifyConnectionStatusClient() for client-side usage.');
  }
  
  const now = Date.now();
  
  // Return cached status if it's still fresh
  if (cachedConnectionStatus !== null && (now - lastStatusCheck) < STATUS_CACHE_DURATION) {
    return cachedConnectionStatus;
  }
  
  try {
    console.log('🔍 SpotifyStatus: Checking connection status...');
    
    // Dynamic import to avoid bundling server-side code in client
    const { spotifyService } = await import('./spotify');
    
    // Use the most thorough validation method
    const isConnected = await spotifyService.isConnectedAndValid();
    
    // Cache the result
    cachedConnectionStatus = isConnected;
    lastStatusCheck = now;
    
    console.log(`✅ SpotifyStatus: Connection status cached: ${isConnected}`);
    return isConnected;
    
  } catch (error) {
    console.error('❌ SpotifyStatus: Error checking connection:', error);
    
    // Cache the failure result
    cachedConnectionStatus = false;
    lastStatusCheck = now;
    
    return false;
  }
}

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
 * Get cached connection status without making API calls
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
 * Mark Spotify as disconnected (for use when logout or disconnect operations occur)
 * This function is safe to call from both client and server
 */
export function markSpotifyDisconnected(): void {
  console.log('🔄 SpotifyStatus: Marking Spotify as disconnected');
  cachedConnectionStatus = false;
  lastStatusCheck = Date.now();
}

/**
 * Force refresh the connection status (bypass cache) - SERVER-SIDE ONLY
 */
export async function refreshSpotifyConnectionStatus(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    throw new Error('refreshSpotifyConnectionStatus() can only be called on the server side.');
  }
  
  console.log('🔄 SpotifyStatus: Force refreshing connection status...');
  
  // Clear cache
  cachedConnectionStatus = null;
  lastStatusCheck = 0;
  
  // Get fresh status
  return await getSpotifyConnectionStatus();
}
