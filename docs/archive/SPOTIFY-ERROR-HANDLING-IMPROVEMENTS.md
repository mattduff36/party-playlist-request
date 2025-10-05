# Spotify Error Handling Improvements

## Overview
Improved error handling for Spotify disconnection to treat it as a **normal state** rather than a continuous error condition. The system now gracefully handles disconnections with intelligent retry logic and exponential backoff.

## Problem Statement
Previously, when Spotify was disconnected (e.g., invalid tokens, first-time admin login, new device):
- ❌ Continuous error spam in console/logs
- ❌ Repeated failed API calls every 5 seconds
- ❌ No differentiation between temporary and permanent failures
- ❌ Poor user experience with constant retry attempts

## Solution Implemented

### 1. Connection State Manager (`src/lib/spotify-connection-state.ts`)
Created a centralized state manager that tracks:
- Connection status
- Failure count
- Last failure time
- Backoff period
- Permanent failure state

**Key Features:**
- **Exponential Backoff**: 5s → 10s → 20s → 40s → 80s (max 5 minutes)
- **Retry Threshold**: After 5 failures, mark as permanently disconnected
- **Smart Retry Logic**: Prevents API calls during backoff periods
- **Manual Reset**: Allows admin to reset state when ready to reconnect

### 2. Updated Components

#### `src/lib/spotify.ts`
- `refreshAccessToken()`: Checks connection state before attempting refresh
- `isConnectedAndValid()`: Respects backoff periods and permanent failures
- Records successes/failures for state management

#### `src/app/api/spotify/status/route.ts`
- Returns 200 status for disconnected state (not an error)
- Provides `status_message` with user-friendly retry information
- Includes `requires_manual_reconnect` flag
- Suppresses logging for expected disconnection states

#### `src/app/api/spotify/callback/route.ts`
- Resets connection state on successful authentication
- Clears failure counts and backoff timers

#### `src/app/api/admin/spotify-watcher/route.ts`
- Skips polling when permanently disconnected
- Respects backoff periods to prevent unnecessary API calls
- Logs skip reasons for debugging

#### `src/components/admin/SpotifyStatusDisplay.tsx`
- Stops polling when `requires_manual_reconnect` is true
- Displays connection status messages
- Shows "Please reconnect Spotify manually" alert
- Dynamic polling that self-terminates on permanent failure

#### `src/components/admin/SpotifyConnectionPanel.tsx`
- Added "Reset Connection State" button
- Allows admins to manually reset retry logic
- Helpful for when connection issues are resolved

### 3. New API Endpoint

**`POST /api/spotify/reset-connection-state`**
- Admin-authenticated endpoint
- Resets connection state to allow retry attempts
- Useful after fixing Spotify credentials or resolving issues

## Behavior

### Initial Connection Failure
1. **Attempt 1**: Immediate failure → 5s backoff
2. **Attempt 2**: After 5s → 10s backoff
3. **Attempt 3**: After 10s → 20s backoff
4. **Attempt 4**: After 20s → 40s backoff
5. **Attempt 5**: After 40s → **Permanent failure**

### Permanent Disconnection State
- All polling stops automatically
- Status shows: "Disconnected - Manual reconnection required"
- Admin sees clear message to reconnect Spotify
- No more error spam in logs
- API calls return gracefully without errors

### Manual Reconnection
Admin can:
1. Use "Connect to Spotify" button to authenticate
2. Use "Reset Connection State" to clear failure state
3. Successfully reconnect → All timers/counts reset

## Benefits

✅ **No Error Spam**: Expected disconnections don't flood logs  
✅ **Smart Retry Logic**: Exponential backoff prevents hammering Spotify API  
✅ **Clear User Feedback**: Status messages explain what's happening  
✅ **Automatic Polling Control**: Stops wasting resources when disconnected  
✅ **Manual Recovery**: Admin can reset state when ready  
✅ **Better UX**: Clear distinction between temporary and permanent failures  
✅ **Resource Efficient**: No unnecessary API calls or polling  

## Configuration

Can be adjusted in `src/lib/spotify-connection-state.ts`:

```typescript
const MAX_RETRY_ATTEMPTS = 3;           // Attempts before asking for help
const BASE_BACKOFF_MS = 5000;           // Initial backoff (5s)
const MAX_BACKOFF_MS = 300000;          // Max backoff (5min)
const PERMANENT_FAILURE_THRESHOLD = 5;  // Failures before stopping
```

## Testing

To test the improved behavior:

1. **Start with Spotify disconnected**:
   - No errors in console after 5 failures
   - Polling stops automatically
   - Status shows "Manual reconnection required"

2. **Temporary connection issues**:
   - System retries with increasing backoff
   - Recovers automatically on success
   - Clear status messages during retry

3. **Manual reset**:
   - Click "Reset Connection State" button
   - Retry attempts resume
   - Can attempt reconnection again

## Status Messages

- `"Connected"` - Successfully connected
- `"Not connected"` - No tokens available
- `"Retrying in Xs (attempt N/5)"` - In backoff period
- `"Connection issues detected (N/5 failures)"` - Active retry mode
- `"Disconnected - Manual reconnection required"` - Stopped retrying

## Migration Notes

- Connection state is stored in memory (resets on server restart)
- Existing disconnected states will trigger retry logic on next check
- No database changes required
- Backward compatible with existing admin flows

