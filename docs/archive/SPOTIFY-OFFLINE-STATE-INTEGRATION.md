# Spotify Offline State Integration

## Overview
Integrated Spotify connection management with the event state system, so Spotify respects the "Offline" state and automatically disconnects/disables when the admin sets the event to offline.

## Problem Statement
Previously:
- Spotify would try to connect regardless of event state
- No automatic cleanup when going offline
- Wasted resources polling Spotify when event is offline
- Confusing UX - why is Spotify trying to connect when offline?

## Solution Implemented

### 1. State Control Panel Auto-Cleanup (`src/components/admin/StateControlPanel.tsx`)

When admin clicks "Offline" button, the system now automatically:

**Disconnects Spotify:**
- Calls `/api/spotify/disconnect` endpoint
- Clears Spotify tokens and connection state
- Logs action for debugging

**Disables Pages:**
- Checks which pages are currently enabled (Requests, Display)
- Calls `/api/event/pages/{page}` with `enabled: false` for each
- Disables both pages if they're enabled
- Prevents public access during offline state

**Error Handling:**
- Non-blocking - continues even if Spotify disconnect fails
- Logs errors but doesn't prevent status change
- Ensures event goes offline regardless of Spotify state

### 2. Spotify Watcher Respects Offline (`src/app/api/admin/spotify-watcher/route.ts`)

Added event state check before attempting Spotify connections:

**Logic:**
```typescript
1. Check current event status from database
2. If status === 'offline', skip all Spotify checks
3. Log skip reason for debugging
4. Return early without API calls
```

**Benefits:**
- No wasted Spotify API calls when offline
- No unnecessary database queries for playback/queue
- No Pusher events for Spotify when offline
- Clean logs showing why checks are skipped

**Order of Checks:**
1. Event status (offline check)
2. Permanent disconnection
3. Backoff period
4. Connection status
5. Actual Spotify API calls

### 3. Spotify Status Dropdown Awareness (`src/components/admin/SpotifyStatusDropdown.tsx`)

Updated UI to show offline state:

**Added:**
- Import `useGlobalEvent` hook
- `isDisabledDueToOffline` flag based on `eventState.status === 'offline'`
- Offline warning message in dropdown
- Power icon for offline state

**UI Changes:**
- **When Offline**: Shows gray box with Power icon
  - Title: "Disabled (Event Offline)"
  - Message: "Spotify is disabled when the event is offline. Change event status to Standby or Live to enable Spotify."
- **When Online**: Shows normal connection status (Connected/Not Connected)

**Polling Control:**
- Stops all status polling when offline
- Resumes polling when event changes to Standby/Live
- Dependencies: `[isDisabledDueToOffline]` triggers effect when state changes

**Action Buttons:**
- Hidden when offline (no "Connect to Spotify" button)
- Only shown when event is Standby or Live
- Prevents attempting connection in wrong state

## Event State Flow

### Going Offline (Standby/Live → Offline)
```
1. Admin clicks "Offline" button
2. StateControlPanel validates transition
3. Disconnect Spotify (POST /api/spotify/disconnect)
4. Disable enabled pages (POST /api/event/pages/*)
5. Update event status (POST /api/event/status)
6. Pusher broadcasts state change
7. All components receive offline state
8. Spotify watcher stops polling
9. Spotify dropdown shows "Disabled" message
```

### Going Online (Offline → Standby/Live)
```
1. Admin clicks "Standby" or "Live" button
2. StateControlPanel validates transition
3. Update event status (POST /api/event/status)
4. Pusher broadcasts state change
5. All components receive new state
6. Spotify watcher resumes polling (if connected)
7. Spotify dropdown shows normal status
8. Admin can connect Spotify if desired
```

## State Transitions

### Offline State
- ❌ Spotify polling disabled
- ❌ Connection attempts prevented
- ❌ Request/Display pages auto-disabled
- ✅ Status dropdown shows "Disabled" message
- ✅ Admin can change to Standby or Live

### Standby State
- ✅ Spotify polling enabled
- ✅ Connection attempts allowed
- ✅ Admin can enable Request/Display pages
- ✅ Status dropdown shows connection status
- ✅ Admin can connect/disconnect Spotify

### Live State
- ✅ Spotify polling enabled
- ✅ Connection attempts allowed
- ✅ Pages typically enabled
- ✅ Full Spotify functionality
- ✅ Normal operation mode

## Benefits

✅ **Resource Efficient** - No wasted API calls when offline  
✅ **Clear UX** - UI explains why Spotify is disabled  
✅ **Automatic Cleanup** - No manual disconnect needed  
✅ **Consistent State** - All systems respect offline mode  
✅ **Prevents Errors** - Can't accidentally connect when offline  
✅ **Better Logs** - Clear messages about why actions are skipped  
✅ **Safety** - Pages auto-disable to prevent public access  

## Technical Details

### Database Queries
- Event status checked at start of Spotify watcher cycle
- Minimal overhead (single SELECT query)
- Cached within request scope
- Falls back gracefully if check fails

### State Synchronization
- Event state managed by GlobalEventProvider
- Real-time updates via Pusher
- All components use same state source
- No race conditions

### Error Handling
- Non-blocking disconnection on offline transition
- Continues even if Spotify disconnect fails
- Logs errors without affecting state change
- Graceful degradation

## Files Modified

1. ✅ `src/components/admin/StateControlPanel.tsx`
   - Added auto-disconnect and page disabling on offline transition
   
2. ✅ `src/app/api/admin/spotify-watcher/route.ts`
   - Added event status check before Spotify operations
   
3. ✅ `src/components/admin/SpotifyStatusDropdown.tsx`
   - Added offline state detection and UI changes
   - Disabled polling when offline
   - Show offline warning message

## Testing Checklist

- [ ] Click "Offline" button when Spotify is connected
  - Verify Spotify disconnects automatically
  - Check enabled pages are disabled
  - Confirm event goes offline
  
- [ ] Check Spotify dropdown when offline
  - Should show "Disabled (Event Offline)" message
  - Should not show "Connect to Spotify" button
  - Should not poll for status
  
- [ ] Check console logs when offline
  - Spotify watcher should log "Skipping check - event is offline"
  - No Spotify API error spam
  
- [ ] Transition offline → standby
  - Spotify dropdown should resume normal status
  - Polling should resume
  - Connect button should appear
  
- [ ] Verify no Spotify calls when offline
  - Check network tab - no `/api/spotify/*` calls
  - No Spotify API requests in logs

## Future Enhancements (Optional)

- Add notification when Spotify auto-disconnects
- Show countdown when transitioning to offline
- Add "Reconnect Spotify" quick action after going live
- Cache last Spotify state to restore after offline period
- Show offline duration in Spotify dropdown

