# Task List: Fix Admin Authentication Issues

**Source:** COMPREHENSIVE-ISSUES-REPORT.md  
**Goal:** Fix authentication token handling in admin pages so state changes and page controls work correctly

## Important Notes

- **Authentication Scope:** Auth is ONLY for `/admin/*` pages
- **Spotify Independence:** Spotify authentication is separate and should NOT use site admin auth
- **Public Pages:** Home and display pages should work without any authentication
- **Token Management:** Admin tokens should expire after 24 hours and clear on logout

## Relevant Files

- `src/lib/state/global-event-client.tsx` - Global event state provider that needs auth token support
- `src/contexts/AdminAuthContext.tsx` - New context to provide admin authentication token
- `src/components/admin/StateControlPanel.tsx` - Event state control panel (uses GlobalEvent)
- `src/components/admin/PageControlPanel.tsx` - Page control panel (uses GlobalEvent)
- `src/components/AdminLayout.tsx` - Admin layout with authentication logic
- `src/app/admin/overview/page.tsx` - Admin overview page with hardcoded values
- `src/app/api/event/status/route.ts` - Event status API endpoint (requires auth for POST)
- `src/app/api/event/pages/route.ts` - Page control API endpoint (requires auth)
- `src/lib/auth.ts` - Authentication service (24-hour token expiry already configured)

## Tasks

- [x] 1.0 Create Admin Authentication Context
  - [x] 1.1 Create `src/contexts/AdminAuthContext.tsx` with token provider
  - [x] 1.2 Context should read token from `localStorage.getItem('admin_token')`
  - [x] 1.3 Context should provide token, setToken, clearToken, and isAuthenticated
  - [x] 1.4 Add token expiry checking using jwt.decode() to check exp claim
  - [x] 1.5 Add automatic token refresh/clear on expiry detection
  
- [x] 2.0 Integrate Auth Context with Global Event Provider
  - [x] 2.1 Modify `global-event-client.tsx` to accept optional token via context
  - [x] 2.2 Add `useAuthContext()` hook inside GlobalEventProvider
  - [x] 2.3 Update `updateEventStatus` to include Authorization header when token exists
  - [x] 2.4 Update `setPageEnabled` to include Authorization header when token exists
  - [x] 2.5 Keep GET requests (refreshState) working without auth for public pages
  - [x] 2.6 Ensure public pages (home, display) still work without auth context
  
- [x] 3.0 Wrap Admin Pages with Auth Context
  - [x] 3.1 Modify `src/app/admin/layout.tsx` to wrap children with AdminAuthProvider
  - [x] 3.2 Ensure AdminAuthProvider is inside GlobalEventProvider
  - [x] 3.3 Test that token is available in admin pages
  - [x] 3.4 Verify public pages don't have auth context (and don't need it)
  
- [x] 4.0 Update AdminLayout to Use Auth Context
  - [x] 4.1 Replace `localStorage.getItem('admin_token')` calls with `useAuthContext()`
  - [x] 4.2 Update login function to use `setToken` from context
  - [x] 4.3 Update logout function to use `clearToken` from context
  - [x] 4.4 Remove duplicate page control buttons from top-right navbar (lines 519-552)
  - [x] 4.5 Keep only notification bell and logout in navbar
  
- [x] 5.0 Fix Admin Overview Page State Display
  - [x] 5.1 Connect quick stats to `useGlobalEvent()` state
  - [x] 5.2 Replace hardcoded "0" with `stats?.total_requests || 0`
  - [x] 5.3 Replace hardcoded "0" with `stats?.pending_requests || 0`
  - [x] 5.4 Replace hardcoded "Off" with dynamic status from `state.pagesEnabled.display`
  - [x] 5.5 Replace hardcoded "Off" with dynamic status from `state.pagesEnabled.requests`
  - [x] 5.6 Replace hardcoded "Live" in header with dynamic `state.status`
  - [x] 5.7 Add proper color coding (green for enabled, red for disabled)
  
- [ ] 6.0 Improve Error Handling and User Feedback
  - [ ] 6.1 Update error messages in StateControlPanel to be user-friendly
  - [ ] 6.2 Remove "No token provided" from user-facing errors
  - [ ] 6.3 Add automatic redirect to login when token is expired/invalid
  - [ ] 6.4 Add loading states during authentication checks
  - [ ] 6.5 Add success notifications for state changes
  - [ ] 6.6 Add error notifications for failed operations
  
- [ ] 7.0 Add Token Expiry and Session Management
  - [ ] 7.1 Add token expiry check on app load
  - [ ] 7.2 Add periodic token validation (every 5 minutes)
  - [ ] 7.3 Show warning 5 minutes before token expires
  - [ ] 7.4 Auto-logout when token expires (after 24 hours)
  - [ ] 7.5 Clear all state on logout
  - [ ] 7.6 Redirect to /admin (login page) on logout
  
- [ ] 8.0 Ensure Spotify Auth Independence
  - [ ] 8.1 Verify Spotify auth uses separate tokens (not admin_token)
  - [ ] 8.2 Confirm Spotify auth flow doesn't require admin authentication
  - [ ] 8.3 Check that Spotify disconnect doesn't affect admin session
  - [ ] 8.4 Verify admin logout doesn't disconnect Spotify
  - [ ] 8.5 Test Spotify can be connected without admin being logged in (if needed)
  
- [ ] 9.0 Test Authentication Flow End-to-End
  - [ ] 9.1 Test admin login stores token correctly
  - [ ] 9.2 Test state transitions work with authentication
  - [ ] 9.3 Test page control toggles work with authentication
  - [ ] 9.4 Test changes persist to database
  - [ ] 9.5 Test public pages work without authentication
  - [ ] 9.6 Test token expiry after 24 hours
  - [ ] 9.7 Test logout clears token and redirects
  - [ ] 9.8 Test multiple admin sessions/devices stay in sync
  
- [ ] 10.0 Clean Up and Remove Duplicate Code
  - [ ] 10.1 Remove duplicate page control buttons from AdminLayout navbar
  - [ ] 10.2 Remove old authentication patterns that don't use context
  - [ ] 10.3 Update all admin components to use unified auth approach
  - [ ] 10.4 Remove temporary testing endpoints (if any were created)
  - [ ] 10.5 Update documentation to reflect new auth flow
  
- [ ] 11.0 Update Testing Suite
  - [ ] 11.1 Update `tests/comprehensive-testing-suite.spec.ts` with new auth flow
  - [ ] 11.2 Add tests for token expiry handling
  - [ ] 11.3 Add tests for automatic logout on token expiry
  - [ ] 11.4 Add tests for auth context provider
  - [ ] 11.5 Add tests verifying public pages work without auth
  - [ ] 11.6 Add tests verifying Spotify auth independence
  
- [ ] 12.0 Final Verification and Documentation
  - [ ] 12.1 Run full test suite to verify no regressions
  - [ ] 12.2 Test all admin pages load correctly
  - [ ] 12.3 Test all state changes persist correctly
  - [ ] 12.4 Verify no "No token provided" errors appear
  - [ ] 12.5 Update TESTING-SUMMARY.md with new findings
  - [ ] 12.6 Create user documentation for admin authentication
  - [ ] 12.7 Mark all tasks as complete and commit changes

## Testing Checklist

After completing all tasks, verify:
- [ ] Admin can login with username/password
- [ ] Token is stored in localStorage as 'admin_token'
- [ ] Token is automatically included in admin API calls
- [ ] Can change event state (offline → standby → live)
- [ ] State changes are saved to database
- [ ] Can toggle requests page on/off
- [ ] Can toggle display page on/off
- [ ] Page control changes are saved to database
- [ ] Quick stats show real-time values
- [ ] No duplicate page controls in UI
- [ ] Public pages (home, display) work without admin auth
- [ ] Spotify authentication is independent of admin auth
- [ ] Token expires after 24 hours
- [ ] Logout clears token and redirects to login
- [ ] No "No token provided" errors in production
- [ ] All admin actions work correctly
- [ ] Real-time updates via Pusher work
- [ ] Multiple admin devices/browsers stay in sync

## Implementation Order

**Phase 1 (Critical):** Tasks 1.0, 2.0, 3.0 - Create auth context and integrate with GlobalEvent  
**Phase 2 (High Priority):** Tasks 4.0, 5.0 - Fix AdminLayout and overview page  
**Phase 3 (Important):** Tasks 6.0, 7.0 - Improve error handling and session management  
**Phase 4 (Verification):** Tasks 8.0, 9.0 - Test Spotify independence and full flow  
**Phase 5 (Cleanup):** Tasks 10.0, 11.0, 12.0 - Clean up, test, document

## Expected Outcome

After completing these tasks:
1. ✅ Admin authentication will work correctly across all admin pages
2. ✅ Event state changes will persist to database
3. ✅ Page control toggles will persist to database
4. ✅ No more "No token provided" errors
5. ✅ Quick stats will show real-time data
6. ✅ Duplicate UI elements will be removed
7. ✅ Token expiry will be handled gracefully
8. ✅ Spotify auth will remain independent
9. ✅ Public pages will work without any authentication
10. ✅ Admin overview page will accurately reflect system state
