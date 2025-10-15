# Multi-Tenant Security & Feature Testing PRD

**Date**: 2025-10-15  
**Priority**: CRITICAL  
**Type**: Security Validation + Feature Testing  
**Estimated Duration**: 60-90 minutes

---

## Objectives

1. **PRIMARY**: Validate multi-tenant data isolation (CRITICAL SECURITY)
2. **SECONDARY**: Test new features (Setup modal, auto-enable/disable, request deletion on offline)
3. **TERTIARY**: Verify all existing features still work after security fixes

---

## Test Accounts

- **DJ1**: `testuser1` / `testpassword123`
- **DJ2**: `testuser2` / `testpassword123`
- **Spotify Accounts**: User will manually connect (2 separate Spotify accounts)

---

## Test Environment

- **Tool**: Cursor's MCP Browser (real-time visual testing)
- **Server**: http://localhost:3000 (user-controlled)
- **Database**: Production database (already has user_id column)
- **Mode**: Interactive browser testing with manual Spotify connection

---

## Test Suite Structure

### Phase 1: Setup & Baseline (15 min)
**Goal**: Ensure both accounts can log in and access admin panel

1.1. DJ1 Login
1.2. DJ1 Setup Modal Test (NEW FEATURE)
1.3. DJ1 Spotify Connection (PAUSE FOR MANUAL CONNECTION)
1.4. DJ2 Login (separate browser/tab)
1.5. DJ2 Setup Modal Test (NEW FEATURE)
1.6. DJ2 Spotify Connection (PAUSE FOR MANUAL CONNECTION)

### Phase 2: Multi-Tenant Isolation Tests (20 min)
**Goal**: CRITICAL - Verify zero cross-contamination of data

2.1. Data Isolation - Requests
   - DJ1 creates 3 song requests
   - DJ2 creates 3 song requests
   - **VERIFY**: DJ1 admin panel shows ONLY DJ1's 3 requests
   - **VERIFY**: DJ2 admin panel shows ONLY DJ2's 3 requests
   - **VERIFY**: DJ1 display screen shows ONLY DJ1's requests
   - **VERIFY**: DJ2 display screen shows ONLY DJ2's requests

2.2. Data Isolation - Request Management
   - DJ1 approves 1 request
   - **VERIFY**: Only DJ1's request is approved (DJ2's remain pending)
   - DJ2 rejects 1 request
   - **VERIFY**: Only DJ2's request is rejected (DJ1's unaffected)

2.3. Data Isolation - Request Deletion
   - DJ1 deletes 1 approved request
   - **VERIFY**: Only DJ1's request is deleted
   - **VERIFY**: DJ2's requests remain intact
   - Check database: `SELECT COUNT(*) FROM requests WHERE user_id = [DJ1_ID]` should be 2
   - Check database: `SELECT COUNT(*) FROM requests WHERE user_id = [DJ2_ID]` should be 3

2.4. Critical: Offline Cleanup Isolation
   - DJ1 changes status to OFFLINE
   - **VERIFY**: ALL DJ1's requests are deleted (NEW FEATURE FIX)
   - **VERIFY**: ALL DJ2's requests REMAIN (multi-tenant isolation)
   - Check database: `SELECT COUNT(*) FROM requests WHERE user_id = [DJ1_ID]` should be 0
   - Check database: `SELECT COUNT(*) FROM requests WHERE user_id = [DJ2_ID]` should be 3

### Phase 3: New Feature Tests (15 min)
**Goal**: Verify new features work correctly

3.1. Setup Modal
   - DJ1 clicks "Setup" in sidebar
   - **VERIFY**: Modal appears with all fields
   - DJ1 changes: Event Title, Welcome Message, Auto-decline explicit (Yes), Auto-approve (No), Max requests (5)
   - **VERIFY**: Settings are saved
   - **VERIFY**: Changes appear in request page

3.2. Auto-Enable Pages on LIVE
   - DJ2 has pages disabled
   - DJ2 changes status to LIVE
   - **VERIFY**: Requests and Display pages are AUTO-ENABLED (NEW FEATURE)
   - **VERIFY**: Guest can access request page

3.3. Auto-Pause & Disconnect on OFFLINE
   - DJ2 is playing music
   - DJ2 changes status to OFFLINE
   - **VERIFY**: Spotify pauses (NEW FEATURE)
   - **VERIFY**: Spotify disconnects
   - **VERIFY**: ALL DJ2's requests are deleted (NEW FEATURE FIX)

### Phase 4: Auto-Mark Played (10 min)
**Goal**: Verify multi-tenant isolation in spotify-watcher

4.1. DJ1 Auto-Mark Test
   - DJ1 creates 2 requests for songs
   - DJ1 approves both
   - DJ1 manually plays the first song in Spotify
   - **VERIFY**: First request auto-marks as "Played" (NEW FEATURE)
   - **VERIFY**: Only DJ1's request is marked (not DJ2's if same song)

4.2. DJ2 Auto-Mark Test
   - DJ2 creates 2 requests for songs
   - DJ2 approves both
   - DJ2 manually plays the first song in Spotify
   - **VERIFY**: First request auto-marks as "Played"
   - **VERIFY**: Only DJ2's request is marked (not DJ1's)

### Phase 5: Guest Flow Tests (10 min)
**Goal**: Verify guests can only submit to correct DJ

5.1. DJ1 Guest Submissions
   - Open DJ1's request page: `http://localhost:3000/testuser1/request?bt=...`
   - Submit 2 song requests as guest
   - **VERIFY**: Requests appear ONLY in DJ1's admin panel
   - **VERIFY**: Requests DO NOT appear in DJ2's admin panel

5.2. DJ2 Guest Submissions
   - Open DJ2's request page: `http://localhost:3000/testuser2/request?bt=...`
   - Submit 2 song requests as guest
   - **VERIFY**: Requests appear ONLY in DJ2's admin panel
   - **VERIFY**: Requests DO NOT appear in DJ1's admin panel

### Phase 6: Display Screen Isolation (10 min)
**Goal**: Verify display screens show only relevant DJ's data

6.1. DJ1 Display Screen
   - Open DJ1's display: `http://localhost:3000/testuser1/display`
   - **VERIFY**: Shows ONLY DJ1's approved requests
   - **VERIFY**: Shows ONLY DJ1's now playing
   - **VERIFY**: Does NOT show any DJ2 data

6.2. DJ2 Display Screen
   - Open DJ2's display: `http://localhost:3000/testuser2/display`
   - **VERIFY**: Shows ONLY DJ2's approved requests
   - **VERIFY**: Shows ONLY DJ2's now playing
   - **VERIFY**: Does NOT show any DJ1 data

### Phase 7: Database Integrity Checks (5 min)
**Goal**: Verify database-level isolation

7.1. Direct Database Queries
   ```sql
   -- Verify all requests have user_id
   SELECT COUNT(*) FROM requests WHERE user_id IS NULL;
   -- Expected: 0
   
   -- Verify DJ1 requests count
   SELECT COUNT(*) FROM requests WHERE user_id = (SELECT id FROM users WHERE username = 'testuser1');
   
   -- Verify DJ2 requests count
   SELECT COUNT(*) FROM requests WHERE user_id = (SELECT id FROM users WHERE username = 'testuser2');
   
   -- Verify foreign key constraint
   SELECT constraint_name FROM information_schema.table_constraints 
   WHERE table_name = 'requests' AND constraint_type = 'FOREIGN KEY';
   -- Expected: fk_requests_user_id
   ```

---

## Success Criteria

### Critical (Must Pass)
- ✅ NO cross-contamination of requests between DJ1 and DJ2
- ✅ Offline status deletes ONLY user's requests (not all)
- ✅ Auto-mark played only affects user's requests
- ✅ Guest submissions go to correct DJ
- ✅ Display screens show only relevant DJ's data
- ✅ Database has NO null user_id in requests

### Important (Should Pass)
- ✅ Setup modal saves settings correctly
- ✅ Auto-enable pages on LIVE works
- ✅ Auto-pause/disconnect on OFFLINE works
- ✅ All existing features still work after security fix

### Nice to Have
- ✅ No console errors during tests
- ✅ Pusher events work correctly
- ✅ UI is responsive and smooth

---

## Failure Scenarios

If ANY of these occur, STOP and FIX IMMEDIATELY:

1. **DJ1 sees DJ2's requests** (CRITICAL SECURITY BREACH)
2. **DJ2 sees DJ1's requests** (CRITICAL SECURITY BREACH)
3. **DJ1 going offline deletes DJ2's requests** (CRITICAL DATA LOSS)
4. **Guest submission appears in wrong DJ's panel** (CRITICAL ROUTING ERROR)
5. **Any database query returns null user_id** (CRITICAL SCHEMA ERROR)

---

## Testing Notes

- Use separate browser windows/tabs for DJ1 and DJ2
- Keep both admin panels open side-by-side for real-time comparison
- Manually verify Spotify connection when prompted
- Take screenshots of any failures
- Note exact steps to reproduce any issues

---

## Test Execution Plan

1. **Start**: User confirms dev server is running
2. **Phase 1**: Login both accounts, setup, connect Spotify (with pauses)
3. **Phase 2**: CRITICAL multi-tenant isolation tests
4. **Phase 3-6**: Feature and flow tests
5. **Phase 7**: Database verification
6. **Report**: Generate summary of results

---

## Deliverables

1. Test execution log (console output)
2. Pass/Fail status for each test
3. Screenshots of any failures
4. Database query results
5. Final security assessment report

---

## Timeline

- **Setup & Login**: 15 min
- **Security Tests**: 20 min
- **Feature Tests**: 25 min
- **Database Checks**: 5 min
- **Report Generation**: 5 min
- **Total**: ~70 minutes

---

**Ready to Execute**: YES  
**Requires Manual Intervention**: YES (Spotify connections)  
**Automation Level**: Semi-automated (browser-driven with manual Spotify steps)

