# Notice Board Message Fix - Test Plan

## Issue Fixed
**Problem**: Notice board messages were not displaying when "Show Requests when Approved" setting was enabled.

**Root Cause**: Data source mismatch
- Message queue system writes approval messages to `events.config` JSONB field
- `/api/public/event-config` endpoint was reading from `user_settings.message_text`
- Display page couldn't fetch messages because they were in different database locations

**Solution**: Updated `/api/public/event-config` to read message data from `events.config` table, matching where the message queue writes.

## Files Changed
1. `src/app/api/public/event-config/route.ts` - Now fetches message data from `events.config` JSONB
2. `src/app/api/display/current/route.ts` - Added complete display settings (previous fix)
3. `src/app/api/public/display-data/route.ts` - Added complete display settings (previous fix)

## Test Procedure

### Setup (5 minutes)
1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Log in as admin**
   - Navigate to `http://localhost:3000/testuser2/admin`
   - Credentials: `testuser2` / `q09ww8qe`

3. **Enable the feature**
   - Go to "Display Settings" tab
   - Expand "Notice Board" section
   - Check ✅ "Show Requests when Approved"
   - Click "Save Display Settings"
   - Verify success message appears

4. **Verify event is Live**
   - Go to "Overview" tab
   - Ensure event status is "Live" (green)
   - If not, click "Standby" then "Live"

### Test Case 1: Manual Approval Message (Critical)
**Expected**: Notice board displays approval message when admin manually approves a request

1. **Open display page in separate window/tab**
   - Navigate to `http://localhost:3000/testuser2/display`
   - Position window so you can see both admin and display

2. **Submit a test request** (or use existing pending request)
   - Go to `http://localhost:3000/testuser2/request`
   - Search for any song (e.g., "Bohemian Rhapsody")
   - Enter a nickname (e.g., "TestUser")
   - Submit request

3. **Approve the request in admin panel**
   - In admin panel, go to "Request Management"
   - Find the pending request
   - Click "Approve" button
   - Check "Add to Queue" and/or "Add to Playlist"
   - Confirm approval

4. **Verify display page shows message**
   - ✅ Notice board section should expand horizontally (1 second)
   - ✅ Then expand vertically and show text (1 second)
   - ✅ Message format should be:
     ```
     [TestUser]          ← 2x larger font
     
     has requested
     
     [Song Title]
     by
     [Artist Name]
     
     Added to the
     Party Playlist!
     ```
   - ✅ Message should display for 10 seconds
   - ✅ Then collapse smoothly

5. **Check console logs**
   - Open browser DevTools → Console
   - Look for these logs:
     ```
     💬 Pusher: Message update {...}
     🎬 Starting notice board animation for message: TestUser...
     🎬 Phase 1: Horizontal expansion
     🎬 Phase 2: Vertical expansion + text fade-in
     🎬 Animation complete
     ```

### Test Case 2: Auto-Approval Message
**Expected**: Notice board displays message when auto-approve is enabled

1. **Enable auto-approve**
   - Admin panel → "Display Settings"
   - Check ✅ "Auto-approve Requests"
   - Save settings

2. **Submit a request**
   - Go to request page
   - Submit a new song request with different nickname

3. **Verify display page shows message immediately**
   - Should see the same animation and message format
   - No manual approval needed

### Test Case 3: Multiple Approvals (Queue System)
**Expected**: Messages queue up and display sequentially without overlap

1. **Prepare 3 pending requests**
   - Submit 3 different song requests
   - Use different nicknames for each

2. **Approve all 3 quickly (within 5 seconds)**
   - Click approve on all 3 requests rapidly

3. **Verify sequential display**
   - ✅ First message displays for full 10 seconds
   - ✅ Second message appears immediately after first ends
   - ✅ Third message appears after second ends
   - ✅ No overlapping messages

4. **Check server logs**
   - Look for:
     ```
     📨 [MessageQueue] Message queued for user [userId]. Queue length: 1
     📤 [MessageQueue] Sending message for user [userId]
     ⏳ [MessageQueue] Waiting [X]ms for current message to finish
     ✅ [MessageQueue] Message sent successfully to user [userId] via Pusher
     ```

### Test Case 4: Pusher Real-Time Updates
**Expected**: Multiple clients see messages simultaneously

1. **Open display page in 2-3 different browser windows/tabs**
   - Chrome, Firefox, or Chrome Incognito
   - All on `http://localhost:3000/testuser2/display`

2. **Approve a request in admin panel**

3. **Verify all display windows show the same message at the same time**
   - ✅ Same animation timing
   - ✅ Same message content
   - ✅ Same duration

### Test Case 5: Feature Toggle
**Expected**: Messages stop when setting is disabled

1. **Disable the feature**
   - Admin → Display Settings
   - Uncheck ❌ "Show Requests when Approved"
   - Save settings

2. **Approve a request**

3. **Verify no message appears on display page**
   - ✅ Request is approved (check queue/playlist)
   - ✅ No notice board animation
   - ✅ No console logs for message-update

4. **Re-enable the feature**
   - Check ✅ "Show Requests when Approved"
   - Save settings

5. **Approve another request**

6. **Verify message appears again**

### Test Case 6: Edge Cases

#### Empty/Missing Nickname
1. Submit request with empty nickname
2. Approve it
3. ✅ Message should show "Anonymous" instead of blank

#### Long Song/Artist Names
1. Submit request with very long title (e.g., "Supercalifragilisticexpialidocious")
2. Approve it
3. ✅ Text should scale down to fit (check `getMessageFontSize()` function)

#### Rapid Page Refresh
1. Display page is showing a message
2. Refresh the page mid-message
3. ✅ Message should NOT reappear (already expired)
4. ✅ No duplicate messages

### Test Case 7: Database Verification
**Purpose**: Confirm messages are written to correct location

1. **Check events.config after approval**
   ```sql
   SELECT config->>'message_text', 
          config->>'message_duration', 
          config->>'message_created_at'
   FROM events 
   WHERE user_id = (SELECT id FROM users WHERE username = 'testuser2');
   ```
   - Should show the most recent message
   - `message_duration` should be `10`
   - `message_created_at` should be recent timestamp

2. **Verify API endpoint returns correct data**
   ```bash
   curl "http://localhost:3000/api/public/event-config?username=testuser2"
   ```
   - Response should include:
     ```json
     {
       "config": {
         "message_text": "...",
         "message_duration": 10,
         "message_created_at": "2025-..."
       }
     }
     ```

## Success Criteria
- [ ] All 7 test cases pass
- [ ] No console errors during any test
- [ ] Messages display with correct formatting and timing
- [ ] Pusher events trigger reliably
- [ ] Feature toggle works correctly
- [ ] Multiple approvals queue properly
- [ ] Display syncs across multiple clients

## Rollback Plan
If issues occur, revert to commit before:
```bash
git revert 657a455
git push origin main
```

## Production Deployment Checklist
- [ ] All tests pass in development
- [ ] Verify Pusher credentials are set in production env
- [ ] Test with production database
- [ ] Monitor server logs for MessageQueue activity
- [ ] Check display page in real devices (TV, tablet, mobile)
- [ ] Verify no memory leaks with long-running display page

## Known Limitations
1. **Message expiry relies on client-side timer** - If display page is offline when message is sent, it won't see it
2. **No message history** - Only current message is stored in database
3. **10-second duration is hardcoded** - Not configurable per message (by design)

## Monitoring
After deployment, watch for these logs in production:
```
📨 [MessageQueue] Message queued for user
📤 [MessageQueue] Sending message for user
✅ [MessageQueue] Message sent successfully
💬 Pusher: Message update
🎬 Starting notice board animation
```

If these logs don't appear when approving requests with feature enabled, investigation needed.

