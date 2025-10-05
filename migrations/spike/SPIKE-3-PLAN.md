# Spike 3 Plan: Spotify Multi-Tenancy

**Goal:** Validate that multiple users can connect their own Spotify accounts and use them simultaneously without interference.

---

## 🎯 What We're Testing

### Critical Questions:
1. Can we store Spotify tokens per-user in the database?
2. Can multiple Spotify watchers run concurrently without interfering?
3. Does token expiry for UserA affect UserB?
4. Will Spotify API rate limits become an issue with 5-10 concurrent users?
5. Can we maintain acceptable performance?

---

## 🏗️ Current Architecture (Single-Tenant)

```
SpotifyService (Singleton)
  ↓
getAccessToken() 
  ↓
Database: spotify_tokens table (ONE row, admin_id FK)
  ↓
All API calls use same token
```

**Problem:** Only ONE Spotify connection for entire app.

---

## 🔄 Target Architecture (Multi-Tenant)

```
SpotifyService (Per-User Instance)
  ↓
getAccessToken(userId)
  ↓
Database: users table (spotify_access_token column per user)
  ↓
Each user's API calls use their own token
```

**Solution:** Each user has their own Spotify connection.

---

## 📋 Test Scenarios

### Test 1: Token Storage (15 min)
**Test:** Can we store/retrieve per-user tokens?
- Store test tokens for 2 users in database
- Retrieve tokens by user_id
- Verify tokens are isolated

**Success:** Each user has separate tokens stored correctly

---

### Test 2: Token Refresh Independence (15 min)
**Test:** Does refreshing one user's token affect another?
- Expire User1's token
- Refresh User1's token
- Verify User2's token unchanged
- Verify User2 can still make API calls

**Success:** Token refresh is per-user, no cross-contamination

---

### Test 3: Concurrent API Calls (30 min)
**Test:** Can 2 users make Spotify API calls simultaneously?
- User1 gets current playback
- User2 gets current playback (at same time)
- Both succeed with their own data

**Success:** Concurrent API calls work without interference

---

### Test 4: Spotify Watcher Multi-Tenancy (45 min) [MOST COMPLEX]
**Test:** Can we run 2 Spotify watchers simultaneously?
- Start watcher for User1
- Start watcher for User2
- User1 plays Track A
- User2 plays Track B
- Verify User1 sees Track A
- Verify User2 sees Track B
- No cross-contamination

**Success:** Multiple watchers run independently

---

### Test 5: Rate Limiting (30 min)
**Test:** Does Spotify rate limit with concurrent users?
- Simulate 5 concurrent users
- Each makes API calls every 2 seconds
- Monitor for 429 errors (rate limit exceeded)

**Success:** No rate limiting issues detected

---

### Test 6: Performance Degradation (20 min)
**Test:** Does performance suffer with multiple users?
- Measure API call latency with 1 user
- Measure API call latency with 5 users
- Compare results

**Success:** Performance degradation < 50%

---

## ⚠️ Risks & Mitigation

### Risk 1: Rate Limiting
**Symptom:** 429 errors from Spotify API  
**Mitigation:** 
- Implement per-user request queuing
- Add backoff strategy
- Monitor rate limit headers

### Risk 2: Database Connection Pool Exhaustion
**Symptom:** "Too many clients" errors  
**Mitigation:**
- Connection pooling already configured
- Should handle 50 concurrent users easily

### Risk 3: Memory Leaks with Multiple Watchers
**Symptom:** Memory usage grows over time  
**Mitigation:**
- Proper event listener cleanup
- Test for 30 minutes to detect leaks

### Risk 4: Spotify OAuth Per-User Complexity
**Symptom:** OAuth callback confusion  
**Mitigation:**
- Include user_id in OAuth state parameter
- Test OAuth flow for 2 users

---

## 🛠️ Implementation Approach

### Phase 1: Database (Already done in Spike 1!)
✅ `users` table has columns:
- `spotify_access_token`
- `spotify_refresh_token`
- `spotify_token_expires_at`

### Phase 2: Create Multi-Tenant Spotify Service (30 min)
- Create `SpotifyMultiTenantService` class
- Accept `userId` in constructor
- Fetch tokens from `users` table by `user_id`

### Phase 3: Test Token Operations (30 min)
- Test storage
- Test retrieval  
- Test refresh

### Phase 4: Test Concurrent Operations (45 min)
- Create 2 test user Spotify connections
- Make concurrent API calls
- Verify isolation

### Phase 5: Test Watchers (60 min) [HARDEST]
- Refactor watcher to accept `userId`
- Run 2 watchers simultaneously
- Verify no interference

---

## ⏱️ Estimated Time

| Task | Time |
|------|------|
| Setup & Database Tests | 30 min |
| Multi-Tenant Service | 30 min |
| Token Operations | 30 min |
| Concurrent API Calls | 45 min |
| Watcher Testing | 60 min |
| Performance Testing | 30 min |
| Documentation | 15 min |
| **TOTAL** | **~4 hours** |

---

## ✅ Success Criteria

- [ ] Per-user tokens stored and retrieved correctly
- [ ] Token refresh doesn't affect other users
- [ ] Concurrent API calls work (2+ users)
- [ ] Multiple watchers run simultaneously
- [ ] No rate limiting issues (up to 5 users)
- [ ] Performance acceptable (<2x slowdown with 5 users)
- [ ] No memory leaks detected
- [ ] OAuth flow works per-user

**If all criteria met:** Spotify multi-tenancy is VALIDATED ✅

---

## 🚨 Failure Scenarios

### If Rate Limiting Occurs:
- **Impact:** Can only support 2-3 concurrent events (not 10+)
- **Solution:** Implement smart polling (only when changes expected)
- **Fallback:** Upgrade to Spotify for Developers premium tier

### If Watchers Interfere:
- **Impact:** Users see each other's playback
- **Solution:** Complete watcher isolation (separate processes)
- **Fallback:** Queue-based architecture

### If Performance Unacceptable:
- **Impact:** Slow API responses with multiple users
- **Solution:** Caching, request batching
- **Fallback:** Limit concurrent events to 5

---

**Ready to begin testing!** 🚀
