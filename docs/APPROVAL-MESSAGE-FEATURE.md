# Approval Message Feature Implementation

## Overview

This feature adds automatic Notice Board messages when song requests are approved. When enabled, the system will automatically display a 10-second message on the display screen showing the requester's name and song details.

## What Was Implemented

### 1. Database Schema Updates

- Added `show_approval_messages` field to:
  - `EventConfig` interface in `src/lib/db/schema.ts`
  - `EventSettings` interface in `src/lib/db.ts`
  - `EventSettings` interface in `src/contexts/AdminDataContext.tsx`
  - `user_settings` table schema in `src/lib/db.ts` and migration endpoint

### 2. Admin UI Updates

**File**: `src/app/[username]/admin/display/page.tsx`

Added a new checkbox in the "Notice Board" section:
- Label: "Show Requests when Approved"
- Description: "Automatically display a 10-second Notice Board message when a request is approved, showing the requester's name and song details."
- Default value: `false` (disabled)

### 3. API Updates

**File**: `src/app/api/admin/event-settings/route.ts`
- Added `show_approval_messages` parameter handling
- Passes the setting to `updateEventSettings()` function

**File**: `src/app/api/admin/approve/[id]/route.ts`
- Added automatic message sending logic after manual approval
- Checks if `show_approval_messages` is enabled in event settings
- Formats message with line breaks for better readability
- Sets message duration to exactly 10 seconds
- Updates event config via direct SQL
- Triggers Pusher event for real-time display update

**File**: `src/app/api/request/route.ts`
- Added automatic message sending logic for auto-approved requests
- Works the same way as manual approvals
- Ensures messages appear for both manual and automatic approvals

### 4. Migration Support

**File**: `src/app/api/migrate/user-settings/route.ts`
- Added migration to add `show_approval_messages` column to `user_settings` table
- Default value: `FALSE`

**File**: `database/add-show-approval-messages.sql`
- Created standalone migration SQL file for manual execution if needed

## How to Use

### For DJs/Admins:

1. Navigate to the Admin Dashboard
2. Go to "Display Settings"
3. Expand the "Notice Board" section
4. Check the box "Show Requests when Approved"
5. Click "Save Display Settings"

Once enabled:
- Every time you approve a request, a 10-second message will automatically appear on the display screen
- The message will display with line breaks for better readability
- No manual intervention needed for each approval

### For Guests:

When this feature is enabled and a request is approved:
- A nicely formatted message appears on the display screen for 10 seconds
- Shows the requester's name, song title, and artist
- Confirms the song was added to the Party Playlist!

## Technical Details

### Message Format

```typescript
const messageText = `${requesterName}\n\nhas requested\n\n${trackName}\nby\n${artistName}\n\nAdded to the\nParty Playlist!`;
```

Display format (with line breaks and styling):
```
[Requester Name]  <-- 200% larger font (2x size)

has requested

[Song Title]
by
[Artist Name]

Added to the
Party Playlist!
```

**Styling:**
- Requester name appears 200% larger (2em) than other text
- Double line breaks for better spacing
- All text centered

**Data:**
- `requesterName`: Falls back to "Anonymous" if not provided
- `artistName`: Falls back to "Unknown Artist" if not provided
- `trackName`: The song title from Spotify

### Message Duration

Fixed at 8 seconds (reduced from 10 to avoid auto-close automation triggering).

### Message Queueing

The system includes intelligent message queueing to handle multiple simultaneous approvals:

- **Queue System**: Messages are queued per user to prevent overlapping
- **Sequential Display**: Each message displays for its full 8-second duration before the next one appears
- **No Overlap**: If multiple requests are approved at once, messages queue up automatically
- **Automatic Processing**: The queue processes messages in the order they were approved

**Technical Implementation:**
- Server-side in-memory queue (`src/lib/message-queue.ts`)
- Tracks current message end time to prevent conflicts
- Processes queue asynchronously with proper delays
- Each user has their own independent queue

### Database Migration

To apply the database changes, you can either:

1. **Automatic**: Call the migration endpoint (requires admin access):
   ```
   POST /api/migrate/user-settings
   ```

2. **Manual**: Run the SQL file:
   ```sql
   -- From database/add-show-approval-messages.sql
   ALTER TABLE user_settings 
   ADD COLUMN IF NOT EXISTS show_approval_messages BOOLEAN DEFAULT FALSE;
   ```

### Implementation Notes

- Uses existing Notice Board infrastructure
- Leverages Pusher for real-time updates
- Updates stored in JSONB `config` field of `events` table
- Falls back gracefully if message sending fails (won't break approval flow)
- User-specific channels ensure multi-tenant isolation

## Files Modified

1. `src/lib/db/schema.ts` - Added field to EventConfig interface
2. `src/lib/db.ts` - Added field to EventSettings interface and table schema
3. `src/contexts/AdminDataContext.tsx` - Added field to EventSettings interface
4. `src/app/[username]/admin/display/page.tsx` - Added checkbox UI and improved message rendering with line breaks
5. `src/app/api/admin/event-settings/route.ts` - Added API parameter handling
6. `src/app/api/admin/approve/[id]/route.ts` - Added message queueing for manual approvals
7. `src/app/api/request/route.ts` - Added message queueing for auto-approvals
8. `src/app/api/migrate/user-settings/route.ts` - Added migration

## Files Created

1. `src/lib/message-queue.ts` - Message queueing system for sequential display
2. `database/add-show-approval-messages.sql` - Migration SQL file
3. `docs/APPROVAL-MESSAGE-FEATURE.md` - This documentation

## Testing Checklist

### Basic Functionality
- [ ] Enable "Show Requests when Approved" in Display Settings
- [ ] Submit a test request
- [ ] Approve the request from admin dashboard
- [ ] Verify 8-second message appears on display page
- [ ] Check message format is correct (with line breaks and larger name)
- [ ] Disable the setting
- [ ] Approve another request
- [ ] Verify no message appears

### Queue Testing
- [ ] Enable the feature
- [ ] Submit 3-4 requests quickly via Party Simulator
- [ ] Verify messages appear sequentially, not overlapping
- [ ] Verify each message displays for at least 8 seconds
- [ ] Check console logs show queue status
- [ ] Verify all messages eventually display

## Compatibility

- ✅ Multi-tenant: Each user has their own setting
- ✅ Backward compatible: Defaults to disabled
- ✅ Graceful degradation: Won't break if feature fails
- ✅ Real-time updates: Uses existing Pusher infrastructure

