# Phase 1: Multi-Tenant Testing Plan

## 🎯 Testing Goals
Verify that all Phase 1 features work correctly with multi-tenant architecture, JWT authentication, and data isolation.

---

## ✅ Test 1: User Registration & Authentication

### 1.1 Register a New User
1. Navigate to `http://localhost:3000/register`
2. Fill in registration form:
   - **Username:** `testuser` (lowercase, no spaces)
   - **Display Name:** `Test User`
   - **Email:** `test@example.com`
   - **Password:** `testpass123`
3. Click **"Create Account"**
4. **Expected:** Redirected to `/testuser/admin/overview`
5. **Verify:** URL shows `/testuser/admin/overview`, not `/admin/overview`

### 1.2 Logout & Login
1. Click **"Logout"** (top right corner)
2. **Expected:** Redirected to `/login`
3. Fill in login form:
   - **Username:** `testuser`
   - **Password:** `testpass123`
4. Click **"Login"**
5. **Expected:** Redirected to `/testuser/admin/overview`
6. **Verify:** Welcome message shows "testuser" in sidebar

---

## ✅ Test 2: Admin Overview Page

### 2.1 Event Info Panel
1. On `/testuser/admin/overview`, check top section
2. **Expected:** Shows "No active event - Set event to Live or Standby to start"
3. Click **"Live"** in Event Control section
4. **Expected:** Event Info panel updates to show:
   - 📌 Event PIN (4 digits)
   - 🔗 Request Page URL (`/testuser/request`)
   - 📱 QR Code URL (with bypass token)
   - 🖥️ "Generate Display Token" button

### 2.2 Event State Control
1. Try switching between states:
   - **Offline** → **Standby** → **Live** → **Offline**
2. **Expected:** 
   - All transitions work smoothly
   - Event Info panel appears/disappears based on state
   - No console errors

### 2.3 Page Controls
1. Toggle **"Requests Page"** ON/OFF
2. Toggle **"Display Page"** ON/OFF
3. **Expected:** Toggle switches respond smoothly

### 2.4 Spotify Connection
1. Check **Spotify Status Display** section
2. If Spotify connected:
   - **Expected:** Shows current playback, queue, device info
3. If NOT connected:
   - Click **"Connect Spotify"**
   - Follow OAuth flow
   - **Expected:** Returns to overview page with Spotify connected

### 2.5 Request Management Panel
1. Check **Request Management** section at bottom
2. **Expected:** Shows request statistics (0 requests initially)
3. **Verify:** No errors in console

---

## ✅ Test 3: Multi-Tenant Data Isolation

### 3.1 Create Second User Account
1. Open **Incognito/Private window**
2. Navigate to `http://localhost:3000/register`
3. Register second user:
   - **Username:** `janedoe`
   - **Display Name:** `Jane Doe`
   - **Email:** `jane@example.com`
   - **Password:** `janepass123`
4. **Expected:** Redirected to `/janedoe/admin/overview`

### 3.2 Verify Data Isolation
1. **In first browser (testuser):**
   - Set event to **Live**
   - Note the PIN (e.g., `1234`)
2. **In second browser (janedoe):**
   - Set event to **Live**
   - Note the PIN (e.g., `5678`)
3. **Verify:** PINs are different
4. **Verify:** Each user has their own separate event

---

## ✅ Test 4: Public Request Page

### 4.1 Access with PIN (testuser)
1. Open **third browser window** (or incognito)
2. Navigate to `http://localhost:3000/testuser/request`
3. **Expected:** PIN entry screen shows
4. Enter testuser's **4-digit PIN** from Event Info panel
5. Click **"Access Playlist"**
6. **Expected:** 
   - Authenticated successfully
   - Shows RequestForm with search bar
   - "Logout" button in top-right

### 4.2 Submit a Request
1. In **nickname field**, enter: `Guest1`
2. In **search bar**, type: `Levitating Dua Lipa`
3. Wait for search results
4. Click **"Request"** on a track
5. **Expected:** 
   - Success message appears
   - Track name shown in confirmation

### 4.3 Access with Bypass Token (janedoe)
1. In janedoe's admin panel, go to **Event Info** section
2. Copy the **QR Code URL** (contains `?bt=...` parameter)
3. Open in **new browser window**
4. **Expected:** 
   - Skips PIN entry screen
   - Goes directly to RequestForm
   - Authenticated automatically

### 4.4 Submit Request as Second User
1. Enter nickname: `Guest2`
2. Search and request: `Blinding Lights`
3. **Expected:** Success message

---

## ✅ Test 5: Admin Requests Management

### 5.1 View Requests (testuser)
1. In testuser's admin panel, click **"Requests"** in sidebar
2. Navigate to `/testuser/admin/requests`
3. **Expected:** 
   - Shows request from `Guest1` (Levitating)
   - Status: **Pending**
   - Does NOT show janedoe's requests
4. **Verify:** Only testuser's requests visible

### 5.2 Approve Request
1. Click **"Accept"** (green checkmark) on Guest1's request
2. **Expected:**
   - Request moves to **Approved** status
   - Border turns green
   - If Spotify connected: Added to queue

### 5.3 Test "Re-submit" for Rejected
1. Click **"Reject"** (red X) on a request
2. **Verify:** Status changes to **Rejected**
3. Click **"Re-submit"** (blue arrow)
4. **Expected:**
   - Creates new **Pending** request for same song
   - Old rejected request deleted

### 5.4 Random Song Feature
1. Click **"Random Song"** button
2. **Expected:**
   - Spinner shows "Adding..."
   - Random song request appears in list
   - Requester shows "PartyPlaylist Suggestion"

---

## ✅ Test 6: Settings Page

### 6.1 Event Settings
1. Navigate to `/testuser/admin/settings`
2. Change **Event Title** to: `Test Party 2024`
3. Set **Request Limit** to: `5`
4. Enable **Auto-approve all requests**
5. Enable **Auto-decline explicit songs**
6. Click **"Save Settings"**
7. **Expected:** "Settings saved successfully!" message

### 6.2 Verify Settings Applied
1. Go to public request page: `/testuser/request` (with PIN)
2. **Expected:** Header shows "Test Party 2024"
3. Submit a request (with auto-approve enabled)
4. Go back to admin requests page
5. **Expected:** New request auto-approved (green status)

---

## ✅ Test 7: Display Page

### 7.1 Generate Display Token
1. In testuser's admin overview, go to **Event Info** panel
2. Click **"Generate Display Token"**
3. **Expected:** Token appears with copy button
4. Copy the display URL

### 7.2 Access Display Page
1. Open **new browser window**
2. Paste the display URL (contains `?dt=...`)
3. **Expected:**
   - Display page loads without authentication prompt
   - Shows event title "Test Party 2024"
   - Shows **Now Playing** section (if Spotify playing)
   - Shows **Request Queue** with all approved/pending requests

### 7.3 Verify Animations Present
1. **Check for animations:**
   - Progress bar smoothly animates (1000ms transition)
   - Request cards have colored borders (green/yellow/red/blue)
   - Background has gradient (purple/blue/indigo)
   - Text scales responsively
   - Backdrop blur effect on cards
2. **Expected:** ALL animations from original display page intact

### 7.4 Real-Time Updates (if Pusher configured)
1. Keep display page open
2. In **admin panel**, approve a new request
3. **Expected:** Display page updates in real-time (no refresh needed)
4. If **Spotify playing**, watch Now Playing section update

---

## ✅ Test 8: Data Isolation Verification

### 8.1 Cross-User Access Prevention
1. **As testuser**, try to access janedoe's admin:
   - Navigate to `/janedoe/admin/overview`
2. **Expected:** Redirected to login or access denied

### 8.2 Request Isolation
1. **In testuser's admin panel:**
   - Go to Requests page
   - **Verify:** Only shows requests from testuser's guests
2. **In janedoe's admin panel:**
   - Go to Requests page
   - **Verify:** Only shows requests from janedoe's guests
3. **Verify:** No cross-contamination of data

---

## ✅ Test 9: Error Handling

### 9.1 Invalid PIN
1. Go to `/testuser/request`
2. Enter wrong PIN: `9999`
3. **Expected:** Error message "Access denied" or "Invalid PIN"

### 9.2 Expired/Invalid Display Token
1. Try to access display page with fake token:
   - `/testuser/display?dt=fake_token_12345`
2. **Expected:** 
   - Error page shows
   - Message: "Invalid or expired display token"
   - "Login" button available

### 9.3 Non-existent User
1. Try to access: `/nonexistentuser/request`
2. **Expected:** 404 or appropriate error

---

## ✅ Test 10: Spotify Integration (if connected)

### 10.1 Current Playback
1. Start playing music on Spotify
2. Check **Admin Overview** → Spotify Status
3. **Expected:** Shows current track, artist, album, progress

### 10.2 Queue Management
1. In admin panel, approve a request
2. Check Spotify app/device
3. **Expected:** Track added to Spotify queue

### 10.3 Playback Controls (if implemented)
1. Click **Pause** button (if available)
2. **Expected:** Spotify pauses
3. Click **Resume**
4. **Expected:** Spotify resumes

---

## 📊 Test Results Checklist

Mark each section as you complete it:

- [ ] Test 1: User Registration & Authentication
- [ ] Test 2: Admin Overview Page
- [ ] Test 3: Multi-Tenant Data Isolation
- [ ] Test 4: Public Request Page
- [ ] Test 5: Admin Requests Management
- [ ] Test 6: Settings Page
- [ ] Test 7: Display Page
- [ ] Test 8: Data Isolation Verification
- [ ] Test 9: Error Handling
- [ ] Test 10: Spotify Integration

---

## 🐛 Bug Tracking

If you find issues, document them here:

### Issue Template:
```
**Test:** [Test number and name]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Console Errors:**
[Any errors in browser console]

**Server Logs:**
[Any errors in terminal]
```

---

## 🎯 Success Criteria

Phase 1 is **COMPLETE** when:
- ✅ All 10 tests pass without critical errors
- ✅ Data isolation verified (users don't see each other's data)
- ✅ All animations preserved on display page
- ✅ JWT authentication works throughout
- ✅ Public pages accessible with PIN/tokens
- ✅ Real-time updates working (Pusher)

---

## 📝 Notes

- Test with **dev server running**: `npm run dev`
- Use **multiple browsers/windows** for multi-user testing
- Check **browser console** for any errors (F12)
- Check **terminal/server logs** for backend errors
- Test on both **desktop and mobile** if possible

