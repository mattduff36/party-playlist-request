/**
 * Spotify Connection State Manager
 * 
 * Manages connection state, retry logic, and backoff for Spotify API failures.
 * Prevents continuous retry attempts when Spotify is genuinely disconnected.
 */

interface ConnectionState {
  isConnected: boolean;
  failureCount: number;
  lastFailureTime: number | null;
  backoffUntil: number | null;
  permanentlyFailed: boolean;
}

// Configuration
const MAX_RETRY_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000; // 5 seconds
const MAX_BACKOFF_MS = 300000; // 5 minutes
const PERMANENT_FAILURE_THRESHOLD = 5; // After 5 failures, stop trying until manual reconnect

// In-memory state (resets on server restart)
let connectionState: ConnectionState = {
  isConnected: false,
  failureCount: 0,
  lastFailureTime: null,
  backoffUntil: null,
  permanentlyFailed: false,
};

/**
 * Check if we should attempt a Spotify API call
 * Returns false if we're in backoff period or permanently failed
 */
export function shouldAttemptSpotifyCall(): boolean {
  const now = Date.now();
  
  // If permanently failed, don't try
  if (connectionState.permanentlyFailed) {
    return false;
  }
  
  // If in backoff period, don't try
  if (connectionState.backoffUntil && now < connectionState.backoffUntil) {
    return false;
  }
  
  return true;
}

/**
 * Record a successful Spotify API call
 * Resets failure state
 */
export function recordSpotifySuccess(): void {
  connectionState = {
    isConnected: true,
    failureCount: 0,
    lastFailureTime: null,
    backoffUntil: null,
    permanentlyFailed: false,
  };
}

/**
 * Record a failed Spotify API call
 * Implements exponential backoff and permanent failure detection
 */
export function recordSpotifyFailure(errorMessage: string): void {
  const now = Date.now();
  connectionState.failureCount++;
  connectionState.lastFailureTime = now;
  connectionState.isConnected = false;
  
  // Check if we should mark as permanently failed
  if (connectionState.failureCount >= PERMANENT_FAILURE_THRESHOLD) {
    connectionState.permanentlyFailed = true;
    console.warn(`⚠️ Spotify: Marked as permanently disconnected after ${connectionState.failureCount} failures. Manual reconnection required.`);
    return;
  }
  
  // Calculate exponential backoff
  const backoffDuration = Math.min(
    BASE_BACKOFF_MS * Math.pow(2, connectionState.failureCount - 1),
    MAX_BACKOFF_MS
  );
  
  connectionState.backoffUntil = now + backoffDuration;
  
  console.log(`⏳ Spotify: Connection failed (attempt ${connectionState.failureCount}/${PERMANENT_FAILURE_THRESHOLD}). Backing off for ${backoffDuration/1000}s. Error: ${errorMessage}`);
}

/**
 * Get current connection state
 */
export function getSpotifyConnectionState(): Readonly<ConnectionState> {
  return { ...connectionState };
}

/**
 * Get time remaining in backoff period (in ms)
 * Returns 0 if not in backoff
 */
export function getBackoffTimeRemaining(): number {
  if (!connectionState.backoffUntil) return 0;
  const remaining = connectionState.backoffUntil - Date.now();
  return Math.max(0, remaining);
}

/**
 * Check if Spotify is in a permanently failed state
 */
export function isSpotifyPermanentlyDisconnected(): boolean {
  return connectionState.permanentlyFailed;
}

/**
 * Manually reset connection state (call when admin reconnects Spotify)
 */
export function resetSpotifyConnectionState(): void {
  console.log('🔄 Spotify: Connection state manually reset');
  connectionState = {
    isConnected: false,
    failureCount: 0,
    lastFailureTime: null,
    backoffUntil: null,
    permanentlyFailed: false,
  };
}

/**
 * Get a user-friendly status message
 */
export function getConnectionStatusMessage(): string {
  if (connectionState.isConnected) {
    return 'Connected';
  }
  
  if (connectionState.permanentlyFailed) {
    return 'Disconnected - Manual reconnection required';
  }
  
  const backoffRemaining = getBackoffTimeRemaining();
  if (backoffRemaining > 0) {
    const seconds = Math.ceil(backoffRemaining / 1000);
    return `Retrying in ${seconds}s (attempt ${connectionState.failureCount}/${PERMANENT_FAILURE_THRESHOLD})`;
  }
  
  if (connectionState.failureCount > 0) {
    return `Connection issues detected (${connectionState.failureCount}/${PERMANENT_FAILURE_THRESHOLD} failures)`;
  }
  
  return 'Not connected';
}

