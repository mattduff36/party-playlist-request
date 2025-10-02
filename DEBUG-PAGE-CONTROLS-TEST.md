# Debug Page Controls - Testing Guide

## Test Scenario
Toggle page controls in admin panel and verify they disable/enable the public pages in real-time.

## Debug Logging Added
Comprehensive debug logs have been added to trace the entire flow:

### 1. Admin Panel Click (`PageControlPanel.tsx`)
```
🎛️ [PageControlPanel] handlePageToggle called
🎛️ [PageControlPanel] Calling actions.setPageEnabled...
✅ [PageControlPanel] actions.setPageEnabled completed successfully
🎛️ [PageControlPanel] handlePageToggle finished
```

### 2. Global Event Client (`global-event-client.tsx`)
```
🔄 [setPageEnabled] START
🔄 [setPageEnabled] eventId
🔄 [setPageEnabled] token present
🔄 [setPageEnabled] Making API request to /api/event/pages
🔄 [setPageEnabled] API response status
✅ [setPageEnabled] API response data
🔄 [setPageEnabled] Dispatching UPDATE_EVENT
✅ [setPageEnabled] COMPLETE - state updated
```

### 3. API Endpoint (`/api/event/pages`)
```
🌐 [API /event/pages POST] Request received
🌐 [API /event/pages POST] Admin authenticated
🌐 [API /event/pages POST] Request body
🌐 [API /event/pages POST] Current event
🌐 [API /event/pages POST] New config
🌐 [API /event/pages POST] Event updated in DB
📡 [API /event/pages POST] Triggering Pusher event
✅ [API /event/pages POST] Pusher event sent successfully
✅ [API /event/pages POST] Sending response
```

### 4. Pusher Event Reception (`GlobalEventProvider`)
```
📡 [GlobalEventProvider] Received page_control_toggle via Pusher
📡 [GlobalEventProvider] Current state before update
📡 [GlobalEventProvider] New pagesEnabled
✅ [GlobalEventProvider] page_control_toggle state updated
```

### 5. Public Pages State Update
**Home Page:**
```
🏠 [HomePage] Global state updated: { status, pagesEnabled, requestsPageEnabled }
```

**Display Page:**
```
📺 [DisplayPage] Global state updated: { status, pagesEnabled }
```

## Testing Steps

1. **Open Multiple Tabs:**
   - Tab 1: Admin Panel (`http://localhost:3000/admin/overview`)
   - Tab 2: Home Page (`http://localhost:3000/`)
   - Tab 3: Display Page (`http://localhost:3000/display`)

2. **Open Dev Console** in all tabs (F12)

3. **Test Requests Page Toggle:**
   - In Tab 1 (Admin), toggle "Requests Page" to OFF (red)
   - Watch console logs in ALL tabs
   - Tab 2 (Home) should show "🎉 Requests Disabled" message
   - Check console for state updates

4. **Test Display Page Toggle:**
   - In Tab 1 (Admin), toggle "Display Page" to OFF (red)
   - Watch console logs in ALL tabs
   - Tab 3 (Display) should show "🎉 Display Disabled" message
   - Check console for state updates

5. **Toggle Back ON:**
   - Toggle both back to ON (green)
   - Both pages should instantly show their normal content

## What To Look For

### ✅ SUCCESS Indicators:
- All console logs appear in sequence
- API returns 200 status
- Pusher event is triggered
- Public pages receive the event
- UI updates immediately (within 1-2 seconds)
- No error messages

### ❌ FAILURE Indicators:
- Missing logs in the sequence
- API returns error (400/500)
- Pusher event not received on public pages
- UI doesn't update
- State shows old values

## Next Steps After Testing
Once we confirm where the flow breaks (if it does), we'll:
1. Optimize the codebase (remove old/duplicate code)
2. Redesign the overview page UI (cleaner, more professional)

