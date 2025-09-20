/**
 * Centralized Spotify Connection Status Manager
 * 
 * This module provides a single source of truth for Spotify connection status
 * across the entire application. All components and APIs should use this
 * instead of checking connection status independently.
 */

import { spotifyService } from './spotify';

// Global connection status cache
let cachedConnectionStatus: boolean | null = null;
let lastStatusCheck = 0;
const STATUS_CACHE_DURATION = 30000; // 30 seconds

/**
 * Get the current Spotify connection status with caching
 * This is the single source of truth for connection status
 */
export async function getSpotifyConnectionStatus(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached status if it's still fresh
  if (cachedConnectionStatus !== null && (now - lastStatusCheck) < STATUS_CACHE_DURATION) {
    return cachedConnectionStatus;
  }
  
  try {
    console.log('🔍 SpotifyStatus: Checking connection status...');
    
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
 * Force refresh the connection status (bypass cache)
 */
export async function refreshSpotifyConnectionStatus(): Promise<boolean> {
  console.log('🔄 SpotifyStatus: Force refreshing connection status...');
  
  // Clear cache
  cachedConnectionStatus = null;
  lastStatusCheck = 0;
  
  // Get fresh status
  return await getSpotifyConnectionStatus();
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
 */
export function markSpotifyDisconnected(): void {
  console.log('🔄 SpotifyStatus: Marking Spotify as disconnected');
  cachedConnectionStatus = false;
  lastStatusCheck = Date.now();
}
