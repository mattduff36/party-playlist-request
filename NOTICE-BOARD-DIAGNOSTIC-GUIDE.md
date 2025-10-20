# Notice Board Messages - Diagnostic Guide

## Issue Summary
Notice board approval messages are not displaying when requests are approved, despite the feature being implemented correctly.

## Root Cause Analysis
Based on the console logs provided, the `message-update` Pusher event is **NOT being triggered**, which means the message queue is not being invoked. This indicates the `show_approval_messages` setting is likely `false` (disabled) in the database.

## Evidence from Console Logs

### What We SEE ✅
```
� Pusher: Request approved! {...}
� PUSHER: Request approved! {...}
� ANIMATION TRIGGERED! New song: Good 4 U by PartyPlaylist Suggestion
✅ Animation completed for: Good 4 U
```

### What We DON'T SEE ❌
```
📢 [admin/approve] Queueing auto-approval message: "..."
📨 [MessageQueue] Message queued for user ...
📤 [MessageQueue] Sending message for user ...
💬 Pusher: Message update {...}
🎬 Starting notice board animation for message: ...
```

## Diagnostic Steps

### Step 1: Check the Setting Value
The latest code (commit `1c64076`) now includes detailed logging. After approving a request, check the server console for:

```
📋 [admin/approve] Event settings retrieved: {
  show_approval_messages: false,  ← THIS IS THE KEY
  userId: '7beef793-1322-42a1-b2dc-ccf5d9bc8086',
  settingsId: 1
}
```

**Expected**: `show_approval_messages: true`  
**Actual**: `show_approval_messages: false` (likely)

If `false`, you'll also see:
```
ℹ️ [admin/approve] show_approval_messages is disabled, skipping notice board message
```

### Step 2: Verify Admin Panel Setting
1. Go to Admin Dashboard → Display Settings
2. Expand "Notice Board" section
3. Check if **"Show Requests when Approved"** is checked ✅
4. If unchecked, check it and click **"Save Display Settings"**
5. Verify success message appears

### Step 3: Check Database Directly
Query the `user_settings` table to confirm the setting value:

```sql
SELECT 
  user_id,
  show_approval_messages,
  theme_primary_color,
  updated_at
FROM user_settings
WHERE user_id = (SELECT id FROM users WHERE username = 'testuser2');
```

**Expected**: `show_approval_messages: true`

If the column doesn't exist:
```sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_approval_messages BOOLEAN DEFAULT FALSE;
```

Then update the value:
```sql
UPDATE user_settings 
SET show_approval_messages = true 
WHERE user_id = (SELECT id FROM users WHERE username = 'testuser2');
```

### Step 4: Test After Enabling
1. Ensure the setting is enabled in admin panel
2. Submit a new request (or use existing pending)
3. Approve the request
4. Watch server console for the new diagnostic logs
5. Display page should receive `message-update` event
6. Notice board should animate and show message

## Expected Log Sequence (When Working)

### Server Logs
```
✅ [admin/approve] User testuser2 (...) approving request ...
📋 [admin/approve] Event settings retrieved: {show_approval_messages: true, ...}
📢 [admin/approve] Queueing auto-approval message: "PartyPlaylist Suggestion\n\nhas requested..."
📨 [MessageQueue] Message queued for user ... Queue length: 1
📤 [MessageQueue] Sending message for user ...: "PartyPlaylist Suggestion..."
✅ [MessageQueue] Database updated for user ...
✅ [MessageQueue] Message sent successfully to user ... via Pusher
```

### Display Page Console
```
💬 Pusher: Message update {message_text: "...", message_duration: 10, ...}
✅ Setting current message: {text: "PartyPlaylist Suggestion...", duration: 10, ...}
🎬 Starting notice board animation for message: PartyPlaylist Suggestion...
🎬 Phase 1: Horizontal expansion
🎬 Phase 2: Vertical expansion + text fade-in
🎬 Animation complete
```

## Troubleshooting

### Issue: Setting shows as enabled in UI but database has false
**Solution**: The admin panel might not be saving correctly. Check the POST request in browser DevTools Network tab when you click "Save Display Settings". Verify the request body includes `show_approval_messages: true`.

### Issue: Setting is true but still no messages
**Solution**: Check for errors in the message queue:
```
❌ Failed to queue auto-approval message: [error details]
```

Common causes:
- Database connection issues
- Pusher credentials invalid
- `events` table doesn't exist
- SQL syntax error in message queue

### Issue: Messages sent but not received on display page
**Solution**: Check Pusher connection on display page:
```
✅ Pusher connected!
� usePusher: Subscribing to user channel: private-party-playlist-...
```

If no connection, check:
- Pusher credentials in `.env`
- `NEXT_PUBLIC_PUSHER_KEY` is set
- Firewall/network blocking Pusher websockets
- Browser console for Pusher errors

### Issue: Database column doesn't exist
**Solution**: Run migration:
```bash
# Via API
POST http://localhost:3000/api/migrate/user-settings

# Or via SQL
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_approval_messages BOOLEAN DEFAULT FALSE;
```

Then enable the setting for your user.

## Quick Fix Checklist
- [ ] Check server console after approval (new diagnostic logs)
- [ ] Verify `show_approval_messages` value in logs
- [ ] If `false`, go to Admin → Display Settings
- [ ] Check ✅ "Show Requests when Approved"
- [ ] Click "Save Display Settings"
- [ ] Verify success message
- [ ] Approve a new request
- [ ] Check server logs for `📢`, `📨`, `📤` emojis
- [ ] Check display console for `💬 Pusher: Message update`
- [ ] Verify notice board animates

## Additional Resources
- `NOTICE-BOARD-FIX-TEST-PLAN.md` - Comprehensive test procedures
- `docs/APPROVAL-MESSAGE-FEATURE.md` - Original feature specification
- `src/lib/message-queue.ts` - Message queue implementation
- `src/app/[username]/display/page.tsx` - Display page Pusher listener

## Contact Points
- Message Queue: `src/lib/message-queue.ts`
- Approval Endpoint: `src/app/api/admin/approve/[id]/route.ts` (line 143-174)
- Display Listener: `src/app/[username]/display/page.tsx` (line 446-475)
- Settings Interface: `src/lib/db.ts` (line 56-91)

