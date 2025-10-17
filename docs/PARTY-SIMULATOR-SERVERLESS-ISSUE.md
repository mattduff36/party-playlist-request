# Party Simulator Serverless Issue - CRITICAL

## Problem

The party simulator uses `setTimeout` to schedule requests, which **does not work in Vercel's serverless environment**.

### Why It Fails

1. **Serverless functions are short-lived**: They execute for the duration of an HTTP request and then terminate
2. **Timers are cleared**: When the function completes, all pending `setTimeout`/`setInterval` calls are cancelled
3. **No persistent process**: Each request may hit a different serverless instance

### Current Behavior

```
User clicks "Start Simulation"
  ↓
POST /api/superadmin/party-simulator [200] ✅
  ↓
Simulator calls setTimeout(...)
  ↓
HTTP response sent, function completes
  ↓
setTimeout is CANCELLED by serverless runtime ❌
  ↓
Simulation stops immediately
```

## Solutions

### Option 1: Client-Side Simulation (RECOMMENDED)
Move the simulation logic to run in the browser:
- Browser makes requests directly
- Uses `setInterval` which works in browsers
- No serverless limitations

### Option 2: Vercel Cron Jobs
Use Vercel's cron feature to trigger requests periodically:
```
# vercel.json
{
  "crons": [{
    "path": "/api/superadmin/party-simulator/tick",
    "schedule": "*/1 * * * *"  // Every minute
  }]
}
```

### Option 3: External Worker Service
Deploy a separate always-on service (not serverless) to handle simulations

### Option 4: Database-Backed Queue
- Store simulation config in database
- Each API call processes one request
- Frontend polls and triggers next request

## Immediate Fix

For now, the best solution is **Option 1: Move to client-side**. This requires:

1. Remove server-side `setTimeout` logic
2. Move request loop to React component  
3. Use browser's `setInterval` to schedule requests
4. Make requests directly from browser

## Implementation Status

- [ ] Implement client-side simulation
- [ ] Remove serverless-incompatible code
- [ ] Add warning in UI about serverless limitations
- [ ] Update documentation

## Testing

The simulator WILL work in:
- ✅ Local development (Node.js process stays alive)
- ❌ Vercel production (serverless functions)
- ✅ Client-side implementation (browser)
- ✅ Self-hosted with PM2/Docker (long-running process)

