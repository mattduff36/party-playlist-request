# 🧪 Phase 2 Testing Guide - Multi-Tenant Isolation

**Created:** October 7, 2025  
**Purpose:** Comprehensive testing checklist for verifying multi-tenant isolation

---

## ✅ FIXED TODAY

### 1. Pusher Setup Warning - FIXED ✅
**Problem:** Console showed "`⚠️ No userId found, skipping Pusher setup`"

**Root Cause:** API returns `user.id`, client looked for `user.user_id`

**Fix:** Changed `authData.user?.user_id` → `authData.user?.id` in `global-event-client.tsx`

**Verification:** Console now shows:
- `📡 Setting up Pusher for user {userId}`
- `📡 Subscribing to user-specific channel: private-party-playlist-{userId}`
- ✅ NO MORE warnings!

### 2. All Pusher Triggers Updated - FIXED ✅
**What Changed:**
- ✅ Event status changes → user-specific
- ✅ Page controls → user-specific
- ✅ Request submissions → user-specific
- ✅ Request approvals → user-specific
- ✅ Request deletions → user-specific

**Channel Format:** `private-party-playlist-{userId}`

---

## 🧪 TESTING CHECKLIST

### Pre-Test Setup

**Test Accounts:**
- **User 1:** `testspotify` / (password in `.env.local`)
- **User 2:** `testuser2024` / (password in `.env.local`)

**Browser Setup:**
- **Browser 1:** Normal window (login as testspotify)
- **Browser 2:** Incognito/Private window (login as testuser2024)

**URLs:**
- testspotify admin: `http://localhost:3000/testspotify/admin/overview`
- testuser2024 admin: `http://localhost:3000/testuser2024/admin/overview`

---

### Test 1: Event Status Isolation ⭐⭐⭐ CRITICAL

**Goal:** Verify event status changes don't affect other users

**Steps:**
1. Open `testspotify` admin in Browser 1
2. Open `testuser2024` admin in Browser 2
3. Verify both show "offline" status

**Test Actions:**
1. In Browser 1 (testspotify):
   - Click "Live" button
   - ✅ Verify testspotify status changes to "Live"
   - ✅ Verify "Requests" and "Display" buttons become enabled

2. In Browser 2 (testuser2024):
   - ✅ Verify status is STILL "offline" (NOT "Live")
   - ✅ Verify "Requests" and "Display" are STILL disabled
   - ❌ If testuser2024 changed to "Live", TEST FAILS (cross-user interference)

3. In Browser 2 (testuser2024):
   - Click "Standby" button
   - ✅ Verify testuser2024 status changes to "Standby"

4. In Browser 1 (testspotify):
   - ✅ Verify status is STILL "Live" (NOT "Standby")
   - ❌ If testspotify changed, TEST FAILS

**Expected Result:** ✅ Each user's event status is completely independent

---

### Test 2: Page Controls Isolation ⭐⭐⭐ CRITICAL

**Goal:** Verify page toggle changes don't affect other users

**Steps:**
1. Set both users to "Standby" or "Live" (page controls require active event)

**Test Actions:**
1. In Browser 1 (testspotify):
   - Toggle "Requests" to ON
   - ✅ Verify testspotify's "Requests" button turns green

2. In Browser 2 (testuser2024):
   - ✅ Verify testuser2024's "Requests" is STILL OFF
   - ❌ If it changed, TEST FAILS

3. In Browser 2 (testuser2024):
   - Toggle "Display" to ON
   - ✅ Verify testuser2024's "Display" button turns green

4. In Browser 1 (testspotify):
   - ✅ Verify testspotify's "Display" is STILL OFF
   - ❌ If it changed, TEST FAILS

**Expected Result:** ✅ Each user's page controls are completely independent

---

### Test 3: Request Flow End-to-End ⭐⭐ HIGH PRIORITY

**Goal:** Verify requests are user-specific

**Steps:**
1. Set testspotify event to "Live" with "Requests" enabled
2. Set testuser2024 event to "Live" with "Requests" enabled

**Test Actions:**
1. Submit request for testspotify:
   - Open `http://localhost:3000/testspotify/request`
   - Enter name: "Alice"
   - Search for "Happy" and select a song
   - Submit request

2. Check testspotify admin:
   - Open testspotify admin requests page
   - ✅ Verify "Alice's" request appears
   - Count total requests (e.g., 2 pending)

3. Check testuser2024 admin:
   - Open testuser2024 admin requests page
   - ✅ Verify "Alice's" request DOES NOT appear
   - ✅ Verify testuser2024 has different requests
   - ❌ If Alice's request appears, TEST FAILS

4. Approve request in testspotify:
   - In testspotify admin, approve Alice's request
   - ✅ Verify it moves to "Approved" status

5. Check testuser2024:
   - ✅ Verify testuser2024's requests are unchanged
   - ❌ If any requests changed, TEST FAILS

**Expected Result:** ✅ Each user has completely isolated request queues

---

### Test 4: Pusher Real-Time Updates ⭐⭐ HIGH PRIORITY

**Goal:** Verify real-time updates work correctly and don't cross users

**Steps:**
1. Open testspotify admin in Browser 1
2. Open Browser Console (F12) in both browsers
3. Watch for Pusher events in console

**Test Actions:**
1. In Browser 1 (testspotify):
   - Change event status to "Live"
   - ✅ Check console for Pusher event
   - ✅ Verify event includes `userId` matching testspotify

2. In Browser 2 (testuser2024):
   - ✅ Verify NO Pusher event received for testspotify's change
   - ✅ Console should NOT show event-config-update from testspotify

3. Submit a request to testspotify:
   - Go to `http://localhost:3000/testspotify/request`
   - Submit a song request
   - In Browser 1 console:
     - ✅ Look for `request-submitted` Pusher event
     - ✅ Verify it includes correct userId

4. In Browser 2 console:
   - ✅ Verify NO request-submitted event received
   - ❌ If testuser2024 receives testspotify's events, TEST FAILS

**Console Logs to Look For:**
- `📡 Setting up Pusher for user {userId}`
- `📡 Subscribing to user-specific channel: private-party-playlist-{userId}`
- `✅ Pusher connected!`
- Pusher event objects should include `userId` field

**Expected Result:** ✅ Each user receives only their own Pusher events

---

### Test 5: Display Page Functionality ⭐ MEDIUM PRIORITY

**Goal:** Verify display pages show correct user's data

**Steps:**
1. Set both users to "Live" with "Display" enabled
2. Submit some requests to each user

**Test Actions:**
1. Open testspotify display:
   - Navigate to `http://localhost:3000/testspotify/display`
   - ✅ Verify QR code shows testspotify URL
   - ✅ Verify event title shows testspotify's configured title
   - ✅ Verify requests shown belong to testspotify

2. Open testuser2024 display:
   - Navigate to `http://localhost:3000/testuser2024/display`
   - ✅ Verify QR code shows testuser2024 URL
   - ✅ Verify event title shows testuser2024's configured title
   - ✅ Verify requests shown belong to testuser2024
   - ❌ If showing testspotify's data, TEST FAILS

3. Real-time updates:
   - Submit new request to testspotify
   - ✅ Verify it appears on testspotify display
   - ✅ Verify it DOES NOT appear on testuser2024 display

**Expected Result:** ✅ Each display page shows only that user's data

---

### Test 6: Settings and Configuration ⭐ MEDIUM PRIORITY

**Goal:** Verify settings are user-specific

**Steps:**
1. Open settings for both users

**Test Actions:**
1. In Browser 1 (testspotify):
   - Go to Settings page
   - Change "Event Title" to "Spotify Party 2024"
   - Change "Auto-approve requests" to ON
   - Save changes

2. In Browser 2 (testuser2024):
   - Go to Settings page
   - ✅ Verify "Event Title" is NOT "Spotify Party 2024"
   - ✅ Verify "Auto-approve" is still OFF (or whatever it was)
   - ❌ If settings changed, TEST FAILS

3. In Browser 2 (testuser2024):
   - Change "Event Title" to "Test User Party"
   - Save changes

4. In Browser 1 (testspotify):
   - Refresh settings page
   - ✅ Verify "Event Title" is STILL "Spotify Party 2024"
   - ❌ If it changed, TEST FAILS

**Expected Result:** ✅ Each user has independent settings

---

### Test 7: Notice Board Feature ⭐ LOW PRIORITY

**Goal:** Verify notice board is user-specific

**Steps:**
1. Open Display Settings for both users

**Test Actions:**
1. In Browser 1 (testspotify):
   - Go to `/testspotify/admin/display`
   - Create a notice: "Testspotify's message"
   - Set duration: 30 seconds
   - Click "Send Message"

2. Check testspotify display:
   - Open `/testspotify/display`
   - ✅ Verify notice appears
   - ✅ Verify it says "Testspotify's message"

3. Check testuser2024 display:
   - Open `/testuser2024/display`
   - ✅ Verify notice DOES NOT appear
   - ❌ If it shows testspotify's message, TEST FAILS

4. In Browser 2 (testuser2024):
   - Create a notice: "Testuser's message"
   - Send message

5. Check both displays:
   - testspotify display: ✅ Shows "Testspotify's message"
   - testuser2024 display: ✅ Shows "Testuser's message"
   - ❌ If messages are crossed, TEST FAILS

**Expected Result:** ✅ Each user's notice board is independent

---

### Test 8: Spotify Integration (If Connected) ⭐ LOW PRIORITY

**Goal:** Verify Spotify tokens are user-specific

**Steps:**
1. Connect Spotify for testspotify (if not already)
2. Check Spotify status for both users

**Test Actions:**
1. In Browser 1 (testspotify):
   - ✅ Verify Spotify shows "Connected"
   - ✅ Verify can see playback controls

2. In Browser 2 (testuser2024):
   - ✅ Verify Spotify shows "Not Connected" (or connected to different account)
   - ❌ If showing testspotify's Spotify connection, TEST FAILS

**Expected Result:** ✅ Each user has independent Spotify connections

---

## 🐛 KNOWN ISSUES

### Minor Issue: Spotify Watcher
**Status:** Pusher disabled  
**Impact:** LOW - Watcher still works, no Pusher events  
**Fix:** Phase 3 - Refactor to per-user watcher

---

## ✅ SUCCESS CRITERIA

**Phase 1 is COMPLETE when:**
- [ ] Test 1 (Event Status Isolation) - PASSES
- [ ] Test 2 (Page Controls Isolation) - PASSES
- [ ] Test 3 (Request Flow) - PASSES
- [ ] Test 4 (Pusher Updates) - PASSES
- [ ] Test 5 (Display Page) - PASSES
- [ ] Test 6 (Settings) - PASSES
- [ ] Test 7 (Notice Board) - PASSES

**Critical Tests (Must Pass):**
- Test 1: Event Status Isolation ⭐⭐⭐
- Test 2: Page Controls Isolation ⭐⭐⭐
- Test 3: Request Flow ⭐⭐

**If any critical test fails:** ❌ Phase 1 NOT complete, bugs need fixing

**If all critical tests pass:** ✅ Phase 1 COMPLETE! 🎉

---

## 📊 TEST RESULTS TEMPLATE

```
## Test Results - {Date}

**Tester:** {Name}
**Environment:** Development / Production

### Test 1: Event Status Isolation
- Status: PASS / FAIL
- Notes: 

### Test 2: Page Controls Isolation
- Status: PASS / FAIL
- Notes: 

### Test 3: Request Flow
- Status: PASS / FAIL
- Notes: 

### Test 4: Pusher Updates
- Status: PASS / FAIL
- Notes: 

### Test 5: Display Page
- Status: PASS / FAIL
- Notes: 

### Test 6: Settings
- Status: PASS / FAIL
- Notes: 

### Test 7: Notice Board
- Status: PASS / FAIL
- Notes: 

### Overall Status
- Critical Tests: {X}/3 passed
- All Tests: {X}/7 passed
- Phase 1 Status: COMPLETE / INCOMPLETE
- Blocking Issues: {List any critical bugs}
```

---

## 🚀 After Testing

**If All Tests Pass:**
1. Mark Phase 1 as COMPLETE
2. Move to Phase 2 (polish & optimization)
3. Plan for production deployment

**If Tests Fail:**
1. Document failures with screenshots
2. Create bug reports with steps to reproduce
3. Fix bugs and re-test

---

## 📝 Notes

- Use browser DevTools console to monitor Pusher events
- Check Network tab for API calls and responses
- Test in both Chrome and Firefox for compatibility
- Test on mobile devices for responsiveness (Phase 2)

**All tests should be performed with fresh logins to avoid cached data issues.**
