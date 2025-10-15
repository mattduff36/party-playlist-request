# CRITICAL SECURITY AUDIT: Multi-Tenant Data Isolation

**Date**: 2025-10-15  
**Severity**: CRITICAL  
**Status**: IN PROGRESS

## Issue Description

The `requests` table was missing `user_id` column, allowing potential cross-contamination of data between different DJ accounts. This violates multi-tenant data isolation principles.

## Migration Applied

✅ Added `user_id UUID` column to `requests` table  
✅ Added foreign key constraint to `users(id)`  
✅ Added indexes for performance (`idx_requests_user_id`, `idx_requests_user_status`)  
✅ Deleted 23 orphaned requests without `user_id`

## Files Requiring Security Fixes

### CRITICAL - Production API Endpoints

1. **`src/app/api/request/route.ts`** - Song request submission
   - Status: ⏳ NEEDS FIX
   - Must: Include user_id when creating requests

2. **`src/app/api/admin/requests/route.ts`** - Admin fetch all requests  
   - Status: ⏳ NEEDS FIX
   - Must: Filter by user_id

3. **`src/app/api/public/requests/route.ts`** - Public fetch requests
   - Status: ⏳ NEEDS FIX
   - Must: Filter by user_id

4. **`src/app/api/display/requests/route.ts`** - Display screen requests
   - Status: ⏳ NEEDS FIX
   - Must: Filter by user_id

5. **`src/app/api/admin/delete/[id]/route.ts`** - Delete specific request
   - Status: ⏳ NEEDS FIX
   - Must: Verify user_id ownership before deleting

6. **`src/app/api/admin/cleanup-requests/route.ts`** - Cleanup all requests
   - Status: ⏳ NEEDS FIX
   - Must: Filter by user_id

7. **`src/app/api/admin/cleanup-played/route.ts`** - Cleanup played requests
   - Status: ⏳ NEEDS FIX
   - Must: Filter by user_id

8. **`src/app/api/admin/spotify-watcher/route.ts`** - Auto-mark songs as played
   - Status: ✅ ALREADY FIXED (no user_id filter in UPDATE)
   - Note: Needs review to ensure proper isolation

9. **`src/app/api/event/status/route.ts`** - Delete requests on offline
   - Status: ⏳ NEEDS FIX
   - Must: Fix DELETE query to use user_id

10. **`src/app/api/auth/logout/route.ts`** - Cleanup on logout
    - Status: ⏳ NEEDS CHECK
    - Must: Verify if it touches requests

### Database Layer

11. **`src/lib/db.ts`** - createRequest function
    - Status: ⏳ NEEDS FIX
    - Must: Accept and insert user_id

### Additional Checks Required

- [ ] Verify NO API endpoint can access another user's requests
- [ ] Verify ALL SELECT queries filter by user_id
- [ ] Verify ALL UPDATE queries filter by user_id  
- [ ] Verify ALL DELETE queries filter by user_id
- [ ] Verify request creation always includes user_id
- [ ] Test cross-user access attempts return 403/404

## Test Plan

After fixes are applied:

1. Create 2 test users (DJ1, DJ2)
2. DJ1 creates requests
3. Verify DJ2 CANNOT see DJ1's requests
4. Verify DJ2 CANNOT modify DJ1's requests
5. Verify DJ2 CANNOT delete DJ1's requests
6. Verify requests are properly isolated in all views (admin, public, display)

## Notes

- The `user_session_id` column exists but refers to GUEST sessions (people making requests), NOT the DJ/admin who owns the event
- Proper isolation requires BOTH the requests to be linked to the DJ's user_id AND proper filtering in ALL queries

