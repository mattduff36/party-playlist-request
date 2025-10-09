# Current Session - Open Issues

**Date:** 2025-10-09
**Branch:** main
**Status:** In Progress

---

## ✅ Fixed & Deployed

### 1. Admin Token Authentication Error
- **Issue:** Admin couldn't approve/reject/delete requests - "No admin token found"
- **Root Cause:** AdminDataContext still using old localStorage tokens instead of JWT cookies
- **Fix:** Replaced all `localStorage.getItem('admin_token')` with `credentials: 'include'`
- **Commit:** 13172c4
- **Status:** ✅ FIXED & PUSHED

### 2. Pusher Auth 404 Error
- **Issue:** `/pusher/auth` endpoint didn't exist
- **Fix:** Created `/api/pusher/auth/route.ts` and updated all Pusher clients to use it
- **Commit:** d03a400
- **Status:** ✅ FIXED & PUSHED

### 3. Notifications 404 Error
- **Issue:** Display page calling `/api/public/notifications` which doesn't exist
- **Fix:** Disabled notifications pending multi-tenant implementation
- **Commit:** d03a400
- **Status:** ✅ FIXED & PUSHED

### 4. Page Controls Not Working
- **Issue:** Toggling page controls in admin didn't affect public pages
- **Fix:** Created `/api/events/public-status` and `/api/users/lookup` endpoints
- **Commit:** 53e897a, e7f9892
- **Status:** ✅ FIXED & PUSHED

---

## ❌ Still Broken - Needs Fixing

### 1. Display Screen - No Queue / No Album Art
**Severity:** HIGH

**User Report:**
> "There are no 'up next' songs on the display screen, and no album art on the now playing track"

**Investigation Needed:**
- Check if `/api/spotify/status` is returning queue data
- Check if display page is correctly fetching and displaying queue
- Check if album art URLs are being returned

**Files to Check:**
- `src/app/[username]/display/page.tsx` - Display logic
- `src/app/api/spotify/status/route.ts` - API endpoint
- Display uses old `/display/page.tsx` as reference

---

### 2. QR Code Bypass Token Not Working
**Severity:** MEDIUM

**User Report:**
> "visiting the 'QR Code URL (No PIN Required)' link still asks for a PIN number"

**Expected Behavior:**
- QR code should contain bypass token (`?bt=...`)
- Bypass token should skip PIN entry entirely
- Should directly authenticate and show request form

**Investigation Needed:**
- Check if bypass token is in QR code URL
- Check if request page handles `?bt=` parameter
- Check if `/api/events/verify-bypass-token` exists

**Files to Check:**
- `src/components/admin/EventInfoPanel.tsx` - QR code generation
- `src/app/[username]/request/page.tsx` - PIN/bypass logic
- `src/app/api/events/verify-bypass-token/route.ts` - Token verification

---

### 3. Logout Doesn't Disable Event
**Severity:** MEDIUM

**User Report:**
> "When the admin 'logs out', the event should automatically disable both requests and display screens, and change the event status to 'Offline'"

**Expected Behavior:**
1. On admin logout:
   - Set event status → `offline`
   - Disable requests page → `false`
   - Disable display page → `false`
   - All public pages should show "Party Not Started"

**Implementation:**
- Add logout handler to `/api/auth/logout` route
- Before clearing JWT, update event:
  ```typescript
  await dbService.updateEventStatus(eventId, 'offline');
  await dbService.updateEvent(eventId, {
    config: {
      ...config,
      pages_enabled: { requests: false, display: false }
    }
  });
  ```

**Files to Modify:**
- `src/app/api/auth/logout/route.ts` - Add event cleanup

---

## 🧪 Testing Checklist (After Fixes)

### Display Screen
- [ ] Load display page - see current track with album art
- [ ] Check "Up Next" section - should show queue
- [ ] Play a song - display should update in real-time

### QR Code Bypass
- [ ] Generate QR code in admin
- [ ] Scan QR code (or copy URL)
- [ ] Should go directly to request form (no PIN)

### Logout Behavior
- [ ] Admin is logged in with event LIVE
- [ ] Click logout
- [ ] Check display page → "Party Not Started"
- [ ] Check requests page → "Party Not Started"
- [ ] Admin panel → Event shows "Offline"

---

## 📝 Notes

### Development Server Issues
- Many Spotify watcher logs (normal)
- Database pool connections (normal)
- No critical errors after fixes

### Multi-Tenant Status
- Phase 1 mostly complete
- Page controls working for admin
- Public pages responding to state changes
- Remaining issues are feature-specific, not architecture

---

## 🔗 Related Commits
- `13172c4` - Fix admin token auth
- `d03a400` - Add Pusher auth endpoint
- `e7f9892` - Fix schema and add debugging
- `53e897a` - Enable page controls for public pages
- `fa8332c` - Fix login links
- `aa7cbcb` - Previous build fixes

---

## Next Steps

1. **Fix Display Screen** (queue + album art)
2. **Fix QR Bypass Token** (no PIN required)
3. **Add Logout Event Cleanup** (disable everything)
4. **Test All Fixes Locally**
5. **Push to Production**
6. **User Acceptance Testing**

