# 🚨 Urgent Fixes Summary

## ✅ FIXED TODAY (Deployed)

### 1. Admin Token Authentication ✅
- **Commit:** `13172c4`, `bc0953e`
- All admin actions (approve/reject/delete) now work
- Using JWT cookie auth instead of localStorage

### 2. Album Art on Display ✅  
- **Commit:** `bc0953e`
- Album art now shows on display screen
- Fixed by extracting image from Spotify playback response

### 3. Pusher Authentication ✅
- **Commit:** `d03a400`
- Created `/api/pusher/auth` endpoint
- Private channels now work

---

## ❌ CRITICAL ISSUES FOUND

### 1. PIN/Bypass Token System Completely Broken
**Severity:** CRITICAL 🔴

**Problem:** 
The `verify-pin` and `verify-bypass-token` functions are querying a `user_events` table that doesn't exist in the current database schema.

**Root Cause:**
- Old architecture: Had `user_events` table with `pin` and `bypass_token` columns
- Current architecture: Has `events` table with `config` JSONB
- **The config doesn't contain PIN or bypass token fields!**

**Current Events Table Structure:**
```typescript
{
  id: uuid,
  user_id: uuid,
  status: 'offline' | 'standby' | 'live',
  version: number,
  config: {
    event_title: string,
    pages_enabled: { requests: boolean, display: boolean },
    welcome_message: string,
    secondary_message: string,
    tertiary_message: string
    // ❌ NO PIN OR BYPASS_TOKEN FIELDS!
  }
}
```

**What's Broken:**
- `/api/events/verify-pin` - Queries non-existent `user_events` table
- `/api/events/verify-bypass-token` - Queries non-existent `user_events` table
- `src/lib/event-service.ts` - `verifyPIN()` and `verifyBypassToken()` functions
- QR codes show bypass URL but bypass doesn't work
- PIN entry form shows but PIN can't be verified

**Files That Need Fixing:**
```
src/lib/event-service.ts (verifyPIN, verifyBypassToken functions)
src/app/api/events/verify-pin/route.ts (uses broken functions)
migrations/ (need to add PIN/bypass to events.config or new table)
```

**Proposed Fix:**
1. **Option A:** Add `pin` and `bypass_token` to `events.config` JSONB:
   ```sql
   UPDATE events 
   SET config = jsonb_set(
     jsonb_set(config, '{pin}', '"1234"'),
     '{bypass_token}', 
     '"unique-bypass-token-here"'
   );
   ```

2. **Option B:** Create new `event_access` table:
   ```sql
   CREATE TABLE event_access (
     id UUID PRIMARY KEY,
     event_id UUID REFERENCES events(id),
     user_id UUID REFERENCES users(id),
     pin TEXT NOT NULL CHECK (pin ~ '^[0-9]{4}$'),
     bypass_token TEXT NOT NULL UNIQUE,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Update verification functions** to query correct table/structure

---

### 2. Display Screen Queue Not Showing
**Severity:** MEDIUM 🟡

**Problem:**
Display page shows "No upcoming songs" even though API returns them.

**Investigation:**
- ✅ API `/api/public/display-data` returns `upcoming_songs` correctly
- ✅ Display page has `setUpcomingSongs()` calls
- ❌ Something is clearing or not setting the state

**Possible Causes:**
- Pusher event overwriting with empty data
- Initial load race condition  
- Data structure mismatch between API and component

**Files to Check:**
```
src/app/[username]/display/page.tsx (lines 606, 490, 356)
Pusher onQueueUpdate handler
```

---

### 3. Display Page Doesn't Auto-Update
**Severity:** HIGH 🟠

**Problem:**
Display page doesn't update when the track changes - requires manual refresh.

**Expected Behavior:**
- Track changes on Spotify → Display updates automatically via Pusher
- No manual refresh needed

**Likely Cause:**
- Pusher `playback-update` event not triggering
- Spotify watcher not detecting track changes
- Event handler not updating display state

**Evidence from logs:**
```
🎵 Spotify watcher: No meaningful changes, skipping Pusher event
```

**Files to Check:**
```
src/app/api/admin/spotify-watcher/route.ts (track change detection)
src/app/[username]/display/page.tsx (Pusher onPlaybackUpdate handler)
src/hooks/usePusher.ts (event binding)
```

---

### 4. Random Song Button Broken
**Severity:** MEDIUM 🟡

**Problem:**
"Add Random Song" button in admin overview doesn't add a pending request to the requests list.

**Expected Behavior:**
- Click "Add Random Song" button
- System picks random track from Spotify
- Adds as pending request
- Shows in requests list

**Files to Check:**
```
src/app/[username]/admin/overview/page.tsx (button handler)
src/app/api/admin/add-random-song/route.ts (API endpoint)
src/contexts/AdminDataContext.tsx (handleAddRandomSong)
```

---

### 5. Logout Doesn't Disable Event
**Severity:** LOW 🟢

**Problem:**
Admin logs out but event stays live and pages stay enabled.

**Expected Behavior:**
On logout:
- Set event status → `offline`
- Disable requests page → `false`
- Disable display page → `false`

**Fix Location:**
```
src/app/api/auth/logout/route.ts
```

**Implementation:**
```typescript
// Before clearing JWT:
const event = await dbService.getEvent(userId);
if (event) {
  await dbService.updateEventStatus(event.id, 'offline', event.version + 1, userId);
  await dbService.updateEvent(event.id, {
    config: {
      ...event.config,
      pages_enabled: { requests: false, display: false }
    }
  }, userId);
}
// Then clear JWT
```

---

## 🎯 Priority Order

1. **CRITICAL:** Fix PIN/Bypass Token System 🔴
   - This is completely broken at the database level
   - Affects all public access to request pages
   - Needs schema migration

2. **HIGH:** Fix Display Auto-Update 🟠
   - Users expect real-time updates
   - Pusher events not working for track changes
   - Core feature for display screens

3. **MEDIUM:** Debug Display Queue Issue 🟡
   - API works, frontend state issue
   - Might self-resolve with page refresh

4. **MEDIUM:** Fix Random Song Button 🟡
   - Feature completely broken
   - Probably API endpoint issue

5. **LOW:** Add Logout Cleanup 🟢
   - Nice-to-have feature
   - Simple code addition

---

## 📝 Session Progress

**Total Issues Today:** 9
- ✅ **Fixed:** 4
- ❌ **Remaining:** 5

**Commits Pushed:** 6
- `13172c4` - Admin token auth
- `bc0953e` - Display album art
- `d03a400` - Pusher auth
- `e7f9892` - Schema fixes
- `53e897a` - Page controls
- `951d9c6` - Documentation

---

## 🔍 Next Steps

1. **Investigate database schema history:**
   - When did `user_events` table get removed?
   - Was PIN/bypass migrated or lost?
   - Check migration files

2. **Decide on PIN/bypass architecture:**
   - JSONB in events.config (simpler)
   - Separate table (more normalized)

3. **Implement chosen solution:**
   - Write migration
   - Update verification functions
   - Test PIN and bypass flows

4. **Test display queue:**
   - Add more console logs
   - Check Pusher events
   - Verify data flow

5. **Add logout cleanup:**
   - Update logout route
   - Test event goes offline
   - Test pages disable

---

**End of Session Summary**

