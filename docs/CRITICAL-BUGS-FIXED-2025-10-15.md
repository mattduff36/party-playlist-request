# 🚨 Critical Bugs Fixed - 2025-10-15

**Date**: October 15, 2025  
**Priority**: CRITICAL - Production Breaking  
**Status**: ✅ FIXED

---

## 🐛 Bug #1: Spotify Watcher Multi-Tenant Isolation Failure

**File**: `src/app/api/admin/spotify-watcher/route.ts`  
**Line**: 205

### Problem:
The Spotify watcher was calling `getRequestsByStatus()` but **NOT passing the `userId` parameter**, causing the multi-tenant isolation check to fail with:

```
🎵 Spotify watcher error: Error: user_id is required for multi-tenant data isolation
    at getRequestsByStatus (src\lib\db.ts:585:11)
```

This error was occurring **EVERY 5 SECONDS** for **EVERY ACTIVE USER**, flooding the console with errors and preventing the auto-mark-as-played feature from working.

### Original Code:
```typescript
const userApprovedRequests = await getRequestsByStatus('approved', 100, 0);
// ❌ Missing userId parameter!
```

### Fixed Code:
```typescript
const userApprovedRequests = await getRequestsByStatus('approved', 100, 0, userId);
// ✅ Now passing userId as the 4th parameter
```

### Impact:
- **Severity**: CRITICAL
- **Affected Users**: ALL users with Spotify connected
- **Functionality Broken**:
  - Auto-mark songs as "Played" feature not working
  - Request-to-song matching not working
  - Requester nicknames not showing on display screen
  - Massive console log spam (error every 5 seconds per user)

---

## 🐛 Bug #2: Random Song Feature Broken

**File**: `src/app/api/admin/add-random-song/route.ts`  
**Lines**: 121-131

### Problem:
The `createRequest()` function signature requires:
```typescript
createRequest(request, userId)
```

But the add-random-song endpoint was passing `user_id` **inside** the request object and also including non-existent database columns:

### Original Code:
```typescript
const newRequest = await createRequest({
  track_uri: selectedTrack.uri,
  track_name: selectedTrack.name,
  artist_name: selectedTrack.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
  album_name: selectedTrack.album?.name || 'Unknown Album',
  duration_ms: selectedTrack.duration_ms,  // ❌ Column doesn't exist in production!
  requester_ip_hash: 'admin_random',
  requester_nickname: 'PartyPlaylist Suggestion',
  status: 'pending',
  spotify_added_to_queue: false,  // ❌ Column doesn't exist in production!
  spotify_added_to_playlist: false,  // ❌ Column doesn't exist in production!
  user_id: userId  // ❌ Should be passed as 2nd parameter, not in object!
});
```

### Fixed Code:
```typescript
const newRequest = await createRequest({
  track_uri: selectedTrack.uri,
  track_name: selectedTrack.name,
  artist_name: selectedTrack.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
  album_name: selectedTrack.album?.name || 'Unknown Album',
  requester_ip_hash: 'admin_random',
  requester_nickname: 'PartyPlaylist Suggestion',
  status: 'pending'
}, userId); // ✅ userId passed as separate parameter
```

### Impact:
- **Severity**: HIGH
- **Affected Users**: ALL admins trying to add random songs
- **Functionality Broken**:
  - "Random Song" button in admin panel returned 500 error
  - Feature completely non-functional

---

## 📊 Root Cause Analysis

### Why These Bugs Occurred:

1. **Multi-Tenant Security Fix Side Effect**:
   - When we added the `user_id` requirement to `getRequestsByStatus()` for security, we updated MOST calls but **missed the Spotify watcher**
   - The function signature has `userId` as the **4th parameter** (after status, limit, offset)
   - Easy to miss when refactoring

2. **Database Schema Mismatch**:
   - The codebase was written for a **new 4-table JSONB schema**
   - Production is running the **old 7-table individual columns schema**
   - Columns like `duration_ms`, `spotify_added_to_queue`, `spotify_added_to_playlist` don't exist in production
   - The `user_id` column was just added via migration today

### Lessons Learned:

1. ✅ **Always audit ALL function calls after changing a function signature**
2. ✅ **Use TypeScript strict mode to catch missing parameters**
3. ✅ **Document the production database schema** (done: `docs/DATABASE-SCHEMA-PRODUCTION.md`)
4. ✅ **Test ALL features after security changes**, not just critical paths

---

## 🧪 Testing Required

### Before Marking as Complete:

- [ ] **Test Spotify Watcher**: Check dev console - should see NO more "user_id is required" errors
- [ ] **Test Auto-Mark Played**: Play an approved song, verify it auto-marks as "Played"
- [ ] **Test Random Song**: Click "Random Song" button in admin panel, verify it adds a request
- [ ] **Test Multi-Tenant Isolation**: Verify DJ1's random song doesn't appear in DJ2's list

---

## 📝 Related Files Modified

1. `src/app/api/admin/spotify-watcher/route.ts` - Fixed getRequestsByStatus call
2. `src/app/api/admin/add-random-song/route.ts` - Fixed createRequest call
3. `docs/CRITICAL-BUGS-FIXED-2025-10-15.md` - This document

---

## 🚀 Next Steps

1. **Monitor dev console** for errors after hot reload
2. **Test both features** in live environment
3. **Run manual multi-tenant tests** from checklist
4. **Push to production** once verified

---

**Fixed By**: AI Assistant  
**Reviewed By**: _(Pending User Review)_  
**Deployed**: _(Pending Verification)_

