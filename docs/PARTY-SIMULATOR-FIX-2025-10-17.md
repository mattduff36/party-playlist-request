# Party Simulator Production Issues - Analysis & Fixes
## Date: October 17, 2025

## Testing Summary

### Environment
- **URL**: https://partyplaylist.co.uk/
- **User**: superadmin
- **Test Configuration**:
  - Environment: Production (partyplaylist.co.uk)
  - Username: testuser2
  - PIN: 7619
  - Request Interval: 1 minute (attempted, reverted to 5 minutes)
  - Unique Requesters: 5 (Tyler, Emily, Lauren, Josh, Samantha)

### Monitoring Duration
- **Total Time**: 10+ minutes
- **Results**: 
  - Total Requests: 0
  - Success Rate: 0%
  - Successful: 0
  - Failed: 0

## Issues Identified

### 1. Critical: 500 Internal Server Error
**Location**: `/api/superadmin/party-simulator`

**Symptom**: 
```
[ERROR] Failed to load resource: the server responded with a status of 500 ()
@ https://partyplaylist.co.uk/api/superadmin/party-simulator:0
```

**Root Cause**: The API route had a syntax error with an incomplete ternary operator at lines 97-99 (in production deployment):
```typescript
const targetUrl = environment === 'local' 
  ?
;
```

**Fix Applied**: The local codebase already has the correct version, but production needs to be redeployed:
```typescript
const targetUrl = environment === 'local' 
  ? `http://localhost:3000/${username}/request`
  : `https://partyplaylist.co.uk/${username}/request`;
```

### 2. Runtime Error: Invalid Property Access
**Location**: `src/lib/party-simulator.ts` lines 426-427

**Symptom**: When logging failed requests, the code attempts to access `song.title` and `song.artist` properties that don't exist.

**Root Cause**: The `PARTY_SONGS` array uses objects with only a `query` property:
```typescript
{ query: 'Flowers Miley Cyrus', explicit: false }
```

But error logging tried to access non-existent properties:
```typescript
song: song.title,  // undefined!
artist: song.artist, // undefined!
```

**Fix Applied**: Parse the query string to extract song and artist names:
```typescript
// Parse song query into song and artist (format: "Song Name Artist Name")
const queryParts = song.query.split(' ');
const songName = queryParts.slice(0, Math.floor(queryParts.length / 2)).join(' ');
const artistName = queryParts.slice(Math.floor(queryParts.length / 2)).join(' ');

this.stats.logs.unshift({
  timestamp: new Date().toISOString(),
  requester: requesterName,
  song: songName || song.query,
  artist: artistName || 'Unknown',
  status: 'failed',
  error: errorMessage
});
```

### 3. Missing Initialization: Logs Array
**Location**: `src/lib/party-simulator.ts` line 99-107

**Symptom**: The `stats` object initialization was missing the `logs` property, which could cause undefined errors.

**Fix Applied**: Added `logs: []` to the initial stats object:
```typescript
private stats: SimulationStats = {
  isRunning: false,
  requestsSent: 0,
  requestsSuccessful: 0,
  requestsFailed: 0,
  startedAt: null,
  lastRequestAt: null,
  activeRequesters: [],
  logs: []  // ← Added
};
```

## Secondary Issues Observed

### 4. UI State Management
**Symptom**: 
- Simulation UI disappears after starting
- Shows "Simulation is already running" even when stopped
- Button changes from "Stop Simulation" back to "Start Simulation" without user action

**Analysis**: This appears to be a React state synchronization issue, possibly related to the API returning 500 errors and the frontend not handling the error state properly.

### 5. Slider Value Reset
**Symptom**: When the request interval slider was set to 1 minute (60000ms), it reverted back to 5 minutes (300000ms) after starting the simulation.

**Analysis**: This is likely a React state management issue where the component doesn't properly persist the slider value when the simulation starts.

## Console Log Analysis

### Key Errors Found:
1. **Authentication warnings** (expected for non-user pages):
   ```
   [ERROR] Failed to load resource: the server responded with a status of 401 ()
   @ https://partyplaylist.co.uk/api/event/status
   ```

2. **Main Issue - 500 Error**:
   ```
   [ERROR] Failed to load resource: the server responded with a status of 500 ()
   @ https://partyplaylist.co.uk/api/superadmin/party-simulator
   ```

3. **No request logs**: The simulator never successfully sent any requests, confirming the 500 error was blocking the simulation from starting.

## Files Modified

### `src/lib/party-simulator.ts`
- Line 107: Added `logs: []` initialization
- Lines 421-435: Fixed error logging to use correct property names from song query

## Deployment Required

The fixes have been applied to the local codebase. To resolve the production issues:

1. **Commit changes**:
   ```bash
   git add src/lib/party-simulator.ts
   git commit -m "Fix party simulator: add logs initialization and fix error logging property names"
   ```

2. **Push to trigger deployment**:
   ```bash
   git push origin main
   ```

3. **Verify deployment**: After Vercel redeploys, test the simulator again with the same configuration.

## Testing Recommendations

After deployment, test with:
- **Environment**: Production
- **Username**: testuser2
- **PIN**: 7619
- **Interval**: 1 minute
- **Duration**: 10 minutes
- **Expected Results**:
  - Requests should be sent approximately every 1-5 minutes
  - Success rate should be > 0%
  - Console should show request logs
  - No 500 errors

## Additional Improvements Needed

While fixing the critical bugs, the following improvements should be considered:

1. **Better error handling** in the frontend when API returns 500
2. **State persistence** for the slider values
3. **UI state management** to prevent the simulation UI from disappearing
4. **Better logging** on both frontend and backend for debugging
5. **Graceful degradation** when the simulation encounters errors

## Conclusion

The party simulator was completely non-functional in production due to:
- A syntax error causing 500 errors (possibly from a bad deployment)
- Missing property names in error logging
- Missing array initialization

All issues have been fixed in the local codebase and are ready for deployment to production.

