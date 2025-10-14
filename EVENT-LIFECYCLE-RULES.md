# Event Lifecycle Rules & Processes

This document defines the business rules and automated processes for managing the event lifecycle in the Party Playlist Request system.

## Table of Contents
1. [Event Lifecycle Rules](#event-lifecycle-rules)
2. [Request Management Rules](#request-management-rules)
3. [Automated Processes](#automated-processes)
4. [Edge Cases & Safeguards](#edge-cases--safeguards)

---

## Event Lifecycle Rules

### Rule 1: Event Shutdown on Logout/Expiry
**Trigger**: When admin logs out OR JWT token expires

**Actions**:
1. Set event status to `offline`
2. Disable both `display` and `requests` pages
3. Clear admin session
4. Stop Spotify watcher for the user

**Implementation Status**: ✅ **COMPLETE**
- Logout route (`src/app/api/auth/logout/route.ts`) handles this
- Token expiry handling exists in AdminDataContext
- Manual status change to offline (`src/app/api/event/status/route.ts`) handles this

**UI Behavior**:
- Display page shows: "Party Not Started - Check back soon!"
- Request page shows: "Party Not Started - The DJ hasn't started the party yet"
- Admin panel redirects to login

---

### Rule 2: Clear All Requests on Event Shutdown
**Trigger**: When event status changes to `offline` (via logout, expiry, or manual change)

**Actions**:
1. Delete ALL requests for the user:
   - Pending requests
   - Approved requests
   - Rejected requests
   - Played requests
2. Clear request stats
3. Notify connected clients via Pusher

**Rationale**:
- Clean slate for next event
- Prevents confusion from old requests
- Ensures data hygiene

**Implementation Status**: ✅ **COMPLETE**
- Implemented in logout route (`src/app/api/auth/logout/route.ts`)
- Implemented in event status change (`src/app/api/event/status/route.ts`)
- Pusher event broadcasts cleanup to all clients
- Standalone API endpoint available (`src/app/api/admin/cleanup-requests/route.ts`)

**Edge Cases Handled**:
- Race condition: Requests submitted during shutdown are prevented by page disable check
- Multiple admin sessions: All sessions receive Pusher notification
- Mid-event accidental logout: Requests are deleted (by design - prevents orphaned data)

---

### Rule 3: Auto-Mark Songs as Played
**Trigger**: When currently playing track matches an approved request

**Actions**:
1. Monitor Spotify "now playing" changes
2. When track changes:
   - Search for matching **approved** requests (by track URI)
   - Update status from `approved` to `played`
   - Record `played_at` timestamp
3. Broadcast status update via Pusher

**Matching Logic**:
- Match by Spotify URI (most accurate)
- Only match against `approved` status requests
- If multiple requests for same song: Mark the oldest approved request first

**Implementation Status**: ✅ **COMPLETE**
- Implemented in Spotify watcher (`src/app/api/admin/spotify-watcher/route.ts`)
- Automatically detects track changes
- Marks oldest approved request as played
- Broadcasts update via Pusher

**Edge Cases Handled**:
- Same song requested multiple times: Only mark one request per play
- DJ plays unrequested song: No action taken
- Track skipped quickly: Still marked as played if it was the "now playing" track

---

### Rule 4: Token Expiry Warning
**Trigger**: 15 minutes before JWT token expires

**Conditions**:
- User is logged into admin panel
- Event status is NOT `offline`
- Token will expire within 15 minutes

**Actions**:
1. Display modal warning user of impending session expiry
2. Show countdown timer
3. Offer "Extend Session" button to refresh token
4. Offer "Logout Now" button
5. If user extends: Generate new JWT with fresh 7-day expiry

**Implementation Status**: ✅ **COMPLETE**
- Token expiry monitoring in `AdminLayout` component
- `TokenExpiryWarning` modal component (`src/components/admin/TokenExpiryWarning.tsx`)
- Session refresh API endpoint (`src/app/api/auth/refresh-session/route.ts`)

**UI Behavior**:
- Modal appears 15 minutes before expiry
- Countdown displays time remaining
- Modal becomes more urgent (red) when < 5 minutes remaining
- Modal auto-dismisses if session extended
- Event continues uninterrupted if session extended

**Technical Details**:
- JWT token decoded client-side to read `exp` field
- Timer checks every second
- Session refresh generates new JWT with same user data
- Old token remains valid until original expiry

---

### Rule 5: Single Admin Session Enforcement
**Trigger**: When admin attempts to login while already logged in elsewhere

**Rules**:
- Only ONE active admin session allowed per user at any time
- Each session has a unique `session_id` stored in database
- Attempting to login from a second device requires transfer confirmation

**Actions**:

**On Initial Login** (No Existing Session):
1. Generate unique `session_id` (UUID)
2. Store in `users.active_session_id` with current timestamp
3. Set JWT auth cookie
4. Proceed to admin panel

**On Login with Existing Session**:
1. Detect existing `active_session_id` in database
2. Return special response with `requiresTransfer: true`
3. Client displays `SessionTransferModal` with options:
   - **Yes, Transfer to This Device**: Proceeds with transfer
   - **No, Stay on Other Device**: Cancels login

**On Transfer Confirmation**:
1. Force logout old session via Pusher (`force-logout` event)
2. Old session receives event and redirects to login with message
3. Generate new `session_id` for new device
4. Update database with new `session_id`
5. Set JWT auth cookie on new device
6. Event continues on new device with same state

**On Logout**:
1. Clear `active_session_id` and `active_session_created_at` from database
2. Clear JWT cookie
3. Proceed with normal logout cleanup

**Implementation Status**: ✅ **COMPLETE**
- Session tracking fields added to `users` table (`active_session_id`, `active_session_created_at`)
- Login API checks for existing sessions (`src/app/api/auth/login/route.ts`)
- Session transfer API endpoint (`src/app/api/auth/transfer-session/route.ts`)
- `SessionTransferModal` component (`src/components/admin/SessionTransferModal.tsx`)
- Pusher `force-logout` event integrated
- AdminDataContext listens for force-logout and redirects
- Logout route clears session tracking

**UI Behavior**:
- Login shows transfer modal if session exists
- Modal displays when existing session was created
- Old device shows alert and redirects to login
- New device continues seamlessly with same event state
- Event remains live throughout transfer (no interruption)

**Technical Details**:
- Session ID is separate from JWT (allows multiple sessions to be tracked)
- Pusher broadcasts to admin channel for old session
- Database stores session creation timestamp for display
- Old JWT remains valid until natural expiry (server validates session ID)

**Edge Cases Handled**:
- Session ID mismatch during transfer: Proceeds anyway (handles race conditions)
- Multiple rapid login attempts: Last one wins
- Browser tabs on same device: Both tabs share same session ID
- Pusher failure: Transfer still succeeds (old device remains logged in until token expires)

---

## Request Management Rules

### Existing Rules (For Reference)

#### Request Limits
- Each user can request up to `X` songs (configurable in settings, default: 10)
- Tracked by `user_session_id` or nickname

#### Request Status Flow
```
submitted → pending → approved → played
                   ↘ rejected
```

#### Auto-Approval
- When enabled: Requests go directly to `approved` status
- When disabled: Requests require manual DJ approval

#### Explicit Content Filtering
- When enabled: Requests marked as explicit are auto-rejected
- Rejection reason: "Explicit content not allowed"

---

## Automated Processes

### Process 1: Event Cleanup on Logout
**File**: `src/app/api/auth/logout/route.ts`

```typescript
// Current implementation:
1. Set event status to 'offline'
2. Disable display and requests pages
3. Clear auth cookie

// To be added:
4. Delete all requests for user
5. Reset request counts
```

### Process 2: Event Cleanup on Token Expiry
**File**: `src/contexts/AdminDataContext.tsx`

```typescript
// Current implementation:
handleTokenExpiration() {
  - Clear local storage
  - Trigger Pusher event
}

// To be added:
- Call backend endpoint to set event offline and clear requests
```

### Process 3: Auto-Mark Played Songs
**File**: `src/app/api/admin/spotify-watcher/route.ts`

```typescript
// New logic to add in Spotify watcher:
When nowPlaying changes:
1. Get current track URI
2. Query for approved requests matching URI
3. Update oldest matching request to 'played'
4. Broadcast via Pusher
```

---

## Edge Cases & Safeguards

### 1. Multiple Requests for Same Song
**Scenario**: Song X is requested by 3 different people, all approved

**Solution**: 
- When Song X plays, mark only the **oldest approved** request as played
- Other instances remain `approved` and can be marked played on subsequent plays
- Prevents mass status changes from one playback

### 2. Request Submitted During Shutdown
**Scenario**: User submits request at exact moment event goes offline

**Solution**:
- Request page checks `pagesEnabled.requests` before showing form
- API endpoint validates event is active before accepting requests
- If request sneaks through, it will be deleted by cleanup process

### 3. Token Expires Mid-Event
**Scenario**: DJ's session expires while event is active with many requests

**Solution**:
- All requests are deleted (by design)
- DJ must restart event and guests can re-request
- Alternative: Could add "Are you sure?" prompt before cleanup
- **Decision**: Accept this behavior for data consistency

### 4. Multiple Admin Sessions
**Scenario**: DJ has 2 browser tabs open, logs out from one

**Solution**:
- Logout affects all sessions via database update
- Pusher broadcasts to all connected clients
- All admin panels redirect to login
- All public pages show "Event ended" message

### 5. Display Screen Left Open After Event
**Scenario**: Display screen remains open after DJ logs out

**Solution**:
- Pusher event triggers immediate UI update
- Display shows "Event has ended" message
- No stale data displayed

### 6. Rapid Event Start/Stop
**Scenario**: DJ toggles event offline/online quickly

**Solution**:
- Each status change is processed sequentially
- Requests are cleared on offline, regardless of how quickly online is toggled
- No race conditions due to database transactions

### 7. Spotify Plays Unrequested Song
**Scenario**: DJ manually queues a song that wasn't requested

**Solution**:
- Auto-mark process only acts on tracks matching approved requests
- Unrequested songs are ignored
- No false positives

### 8. Song Skipped Quickly
**Scenario**: Song plays for 2 seconds, then DJ skips it

**Solution**:
- If it was "now playing", it counts as played
- Status change is instant when track changes
- Prevents marking as played multiple times

---

## Implementation Checklist

### Phase 1: Request Cleanup on Offline ✅
- [x] Add request deletion to logout route
- [x] Add request deletion to token expiry handler (via logout cleanup)
- [x] Add request deletion to manual status change to offline
- [x] Add Pusher event for cleanup notifications
- [x] Create standalone cleanup API endpoint

### Phase 2: Auto-Mark as Played ✅
- [x] Modify Spotify watcher to track previous track
- [x] Add logic to detect track changes
- [x] Implement request matching by URI
- [x] Update request status to 'played'
- [x] Add timestamp recording (played_at)
- [x] Handle multiple requests for same song (oldest first)
- [x] Ignore unrequested songs (no false positives)

### Phase 3: Testing & Validation ⏳
- [ ] Test logout → requests cleared
- [ ] Test token expiry → requests cleared
- [ ] Test manual offline → requests cleared
- [ ] Test song plays → status updated
- [ ] Test same song multiple requests
- [ ] Test rapid event cycling
- [ ] Test multiple admin sessions

---

## Database Impact

### Tables Affected
1. **events**: Status updates to 'offline'
2. **song_requests**: Bulk deletes, status updates to 'played'
3. **user_settings**: Config updates for page enables

### Performance Considerations
- Request deletion: Batch delete by user_id (indexed)
- Request matching: Query by track_uri and status='approved' (indexed)
- Pusher events: Batched where possible
- Spotify watcher: Add minimal overhead (~1 additional query per track change)

---

## Future Enhancements

### Potential Additions
1. **Request History**: Option to export requests before deletion
2. **Soft Delete**: Archive requests instead of hard delete
3. **Confirmation Prompt**: "Are you sure?" before deleting requests on logout
4. **Play Count**: Track how many times each song was actually played
5. **Request Stats**: Store aggregate stats before cleanup
6. **Undo Offline**: Restore event and requests if logged out accidentally

### Configuration Options
- `keep_request_history`: bool (default: false)
- `confirm_before_cleanup`: bool (default: false)
- `auto_mark_played`: bool (default: true)
- `mark_all_duplicates`: bool (default: false)

---

## Monitoring & Logging

### Log Events
- ✅ Event shutdown (logout/expiry)
- ✅ Requests deleted (count)
- ✅ Track changed (new vs old)
- ✅ Request marked as played (id, track name)
- ✅ Status broadcast via Pusher

### Metrics to Track
- Requests per event (before cleanup)
- Average event duration
- Songs played per event
- Request approval rate
- Auto-mark accuracy rate

---

## Related Documentation
- `MULTI-TENANT-AUDIT-COMPLETE.md` - Multi-tenant architecture
- `party-playlist-workflow-diagram.md` - System workflow
- `PRODUCTION-READY-AUDIT.md` - Production readiness

---

**Last Updated**: 2025-10-14
**Version**: 1.0
**Status**: Rules 1, 2, and 3 fully implemented - Ready for testing

