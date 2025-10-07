# Spotify Re-Authentication Issue

**Priority:** 🟢 RESOLVED  
**Status:** ✅ FIXED - See SPOTIFY-AUTH-ISSUE-RESOLVED.md  
**Fixed:** 2025-01-06 (continued session)  
**Branch:** `phase1/auth-and-landing`

> **⚠️ This issue has been resolved. See `SPOTIFY-AUTH-ISSUE-RESOLVED.md` for details.**

## Problem Description

After disconnecting from Spotify in the admin settings, users cannot reconnect to Spotify. The authentication flow fails at the initial step.

## Error Details

### Console Error
```
Failed to get Spotify auth URL: "Failed to start Spotify authentication"
```

### Stack Trace
```
at handleSpotifyConnect (src\app\[username]\admin\settings\page.tsx:32:17)
```

### Code Location
```typescript:src/app/[username]/admin/settings/page.tsx
  30 |       if (!response.ok) {
  31 |         const errorData = await response.json();
> 32 |         console.error('Failed to get Spotify auth URL:', errorData.error);
     |                 ^
  33 |         return;
  34 |       }
  35 |
```

### Environment
- Next.js version: 15.5.2 (Webpack)
- Node.js version: (check in next session)
- Spotify API SDK: (check version)

## Reproduction Steps

1. Navigate to `/:username/admin/settings`
2. If already connected, disconnect from Spotify (if disconnect option exists)
3. Click "Connect Spotify" button
4. Observe error in console
5. No redirect to Spotify authorization page occurs

## Expected Behavior

1. Click "Connect Spotify" button
2. GET `/api/spotify/auth` returns auth URL, state, and code_verifier
3. Browser redirects to Spotify authorization page
4. User authorizes app
5. Spotify redirects back with code
6. App exchanges code for tokens
7. Connection successful

## Actual Behavior

1. Click "Connect Spotify" button
2. GET `/api/spotify/auth` fails with error
3. No redirect occurs
4. User stuck in disconnected state

## Possible Root Causes

### 1. Spotify API Endpoint Changes
- **Hypothesis:** Spotify may have updated their OAuth endpoints for "user accounts"
- **Check:** Review [Spotify Web API Authorization Guide](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- **Action:** Compare current implementation against latest Spotify docs

### 2. Multi-Tenant OAuth State Issues
- **Hypothesis:** OAuth state parameter not correctly scoped to user
- **Check:** Inspect `/api/spotify/auth` implementation
- **Action:** Verify state generation includes user context

### 3. Redirect URI Mismatch
- **Hypothesis:** Redirect URI in code doesn't match Spotify dashboard config
- **Check:** Compare `SPOTIFY_REDIRECT_URI` env var with dashboard setting
- **Action:** Ensure redirect URI includes dynamic username if needed

### 4. Missing or Invalid Environment Variables
- **Hypothesis:** `SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_SECRET` invalid
- **Check:** Verify `.env.local` has correct values
- **Action:** Test credentials with Spotify API directly

### 5. Token Cleanup Not Working
- **Hypothesis:** Old tokens not properly cleared on disconnect
- **Check:** Database state after disconnect
- **Action:** Verify `user_settings` or `spotify_auth` table is cleared

### 6. PKCE Flow Issues
- **Hypothesis:** Code verifier generation or storage broken
- **Check:** localStorage operations for `spotify_code_verifier`
- **Action:** Verify PKCE implementation matches Spotify requirements

## Investigation Checklist

### Backend
- [ ] Check `/api/spotify/auth` endpoint logs
- [ ] Verify environment variables loaded correctly
- [ ] Test Spotify API credentials with curl/Postman
- [ ] Review OAuth state generation logic
- [ ] Check if user_id being passed correctly
- [ ] Verify code_verifier generation (base64url encoding)

### Frontend
- [ ] Check browser console for full error stack
- [ ] Verify fetch request to `/api/spotify/auth` includes credentials
- [ ] Check if localStorage has stale data
- [ ] Test in incognito mode (clean slate)
- [ ] Verify error handling in `handleSpotifyConnect`

### Database
- [ ] Check if old Spotify tokens still in database
- [ ] Verify user_settings table structure
- [ ] Check for any foreign key constraints blocking deletion

### Spotify Dashboard
- [ ] Verify app is not in restricted mode
- [ ] Check redirect URIs list includes our callback URL
- [ ] Verify app credentials haven't expired
- [ ] Check if app has required scopes enabled

## Related Files to Review

```
src/app/api/spotify/auth/route.ts
src/app/api/spotify/callback/route.ts
src/app/[username]/admin/settings/page.tsx
src/lib/spotify.ts
src/lib/spotify-status.ts
.env.local (check SPOTIFY_* variables)
```

## Testing Plan (Next Session)

### 1. Isolate the Issue
```bash
# Test Spotify auth endpoint directly
curl http://localhost:3000/api/spotify/auth \
  -H "Cookie: auth-token=<JWT>" \
  -v
```

### 2. Check Spotify API Directly
```bash
# Verify credentials work
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<ID>&client_secret=<SECRET>"
```

### 3. Test OAuth Flow Manually
- Navigate to Spotify auth URL manually
- Verify redirect works
- Check callback handler

### 4. Review Recent Spotify API Changes
- Check Spotify changelog for breaking changes
- Review OAuth 2.0 flow documentation
- Check if PKCE is now required

## Workarounds (Temporary)

If this blocks testing:
- Use existing connected Spotify account
- Skip Spotify integration tests
- Mock Spotify responses for other feature testing

## Success Criteria

- [ ] User can click "Connect Spotify" button
- [ ] GET `/api/spotify/auth` returns valid auth URL
- [ ] Browser redirects to Spotify authorization page
- [ ] User can authorize app
- [ ] Callback handler successfully exchanges code for tokens
- [ ] Tokens saved to database correctly
- [ ] Admin dashboard shows "Connected" status
- [ ] User can disconnect and reconnect multiple times

## References

- [Spotify Web API Authorization Guide](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [OAuth 2.0 Authorization Code Flow with PKCE](https://oauth.net/2/pkce/)
- [Next.js API Routes Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## Notes

- This issue was discovered at the end of testing session
- Did not have time to investigate root cause
- Blocking complete E2E testing of Spotify integration
- Priority for next session due to impact

## Related Issues

- None yet - this is the first occurrence

## Timeline

- **Discovered:** 2025-01-06 ~19:30
- **Scheduled Fix:** Next session (2025-01-07 or later)
- **Target Resolution:** Within 1-2 hours of investigation

---

**Created by:** AI Assistant  
**Last Updated:** 2025-01-06  
**Status:** 🔴 OPEN - Awaiting investigation

