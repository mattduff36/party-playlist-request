# Task List: Admin Simplified Page Functionality Fixes

Based on the PRD for fixing admin simplified page functionality issues.

## Relevant Files

- `src/app/admin/simplified/page.tsx` - Main admin simplified page component that needs functionality fixes
- `src/components/admin/StateControlPanel.tsx` - Event Control buttons (Offline/Standby/Live) component
- `src/components/admin/PageControlPanel.tsx` - Page Controls (Requests/Display) toggle component
- `src/components/admin/RequestManagementPanel.tsx` - Song Requests management component (to be integrated)
- `src/lib/state/global-event-client.tsx` - Global state management for event control and page states
- `src/app/admin/requests/page.tsx` - Source page for Song Requests functionality to be copied
- `src/app/admin/overview/page.tsx` - Current admin overview page (to be deleted)
- `src/components/AdminLayout.tsx` - Admin layout component (may need navigation updates)
- `src/app/page.tsx` - Home page (affected by Event Control state changes)
- `src/app/display/page.tsx` - Display page (affected by Event Control state changes)
- `src/lib/pusher/events.ts` - Pusher events for real-time synchronization
- `src/app/api/event/[id]/status/route.ts` - API endpoint for event status updates
- `src/app/api/event/[id]/pages/route.ts` - API endpoint for page control updates
- `src/app/api/admin/requests/route.ts` - API endpoint for song requests management

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Fix Event Control State Management
  - [x] 1.1 Implement proper state transitions between Offline/Standby/Live states
  - [x] 1.2 Add state persistence and synchronization across devices via Pusher
  - [x] 1.3 Implement page behavior logic (Offline shows "Party Not Started" on home/display pages)
  - [x] 1.4 Add visual feedback and smooth transitions for state changes
  - [x] 1.5 Ensure Event Control state affects Page Controls availability
  - [x] 1.6 Add error handling and validation for state transitions
  - [x] 1.7 Test Event Control functionality across all states

- [x] 2.0 Resolve Page Controls Integration Issues
  - [x] 2.1 Fix Page Controls to only work when Event Control is in Standby or Live state
  - [x] 2.2 Ensure Requests Page and Display Page controls work independently
  - [x] 2.3 Fix issue where enabling one page disables the other
  - [x] 2.4 Implement immediate page state updates on public pages
  - [x] 2.5 Add real-time synchronization for Page Control changes via Pusher
  - [x] 2.6 Add visual indicators for enabled/disabled page states
  - [x] 2.7 Test Page Controls integration with Event Control states

- [x] 3.0 Integrate Complete Song Requests Management
  - [x] 3.1 Copy complete Song Requests section from `/admin/requests` page
  - [x] 3.2 Integrate all request management functionality (view, approve, reject, delete)
  - [x] 3.3 Add batch operations support for multiple selected requests
  - [x] 3.4 Implement filtering by status (all, pending, approved, rejected)
  - [x] 3.5 Add search functionality for song requests
  - [x] 3.6 Position Song Requests section above Spotify Status section
  - [x] 3.7 Add real-time updates for new requests via Pusher
  - [x] 3.8 Test all Song Requests functionality on simplified page

- [x] 4.0 Restructure Admin Page Navigation
  - [x] 4.1 Delete current `/admin/overview` page
  - [x] 4.2 Rename `/admin/simplified` directory to `/admin/overview`
  - [x] 4.3 Update all navigation links to point to new `/admin/overview`
  - [x] 4.4 Update AdminLayout component navigation references
  - [x] 4.5 Preserve tabbed interface (Overview, Requests, Spotify, Settings)
  - [x] 4.6 Update any hardcoded paths in components
  - [x] 4.7 Test navigation and routing after restructuring

- [x] 5.0 Comprehensive Testing and Validation
  - [x] 5.1 Test Event Control state transitions and page behavior
  - [x] 5.2 Test Page Controls integration and independence
  - [x] 5.3 Test Song Requests management functionality
  - [x] 5.4 Test real-time synchronization across devices
  - [x] 5.5 Test admin authentication and API integration
  - [x] 5.6 Test error handling and edge cases
  - [x] 5.7 Run full test suite to ensure no regressions
  - [x] 5.8 Perform end-to-end admin workflow testing
