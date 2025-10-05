# Technical Spike Plan: Multi-Tenant Architecture Validation

**Project:** PartyPlaylist Multi-Tenant SaaS  
**Purpose:** Validate critical architectural decisions before full implementation  
**Duration:** 3-5 days (time-boxed)  
**Status:** Ready to Execute  
**Created:** October 5, 2025

---

## 🎯 Goal

De-risk the multi-tenant transformation by validating the three most critical architectural unknowns:

1. **Database multi-tenancy** - Can we safely isolate data between users?
2. **Authentication & routing** - Can we enforce per-user URL access control?
3. **Spotify multi-tenancy** - Can multiple users connect their own Spotify accounts simultaneously?

**Success Criteria:** All 3 spikes pass → Proceed with full implementation  
**Failure Criteria:** Any spike fails → Adjust PRD and re-plan

---

## ⏱️ Timeline

| Spike | Duration | Can Start |
|-------|----------|-----------|
| Spike 1: Database | 2 days | **Today** |
| Spike 2: Auth & Routing | 1 day | Day 3 (parallel with Spike 1) |
| Spike 3: Spotify | 2 days | Day 4 |

**Total:** 3-5 days (some tasks can run in parallel)

---

## 🔬 Spike 1: Database Schema & Data Isolation

### **Question to Answer:**
Can we add multi-tenancy to the existing database without breaking existing functionality, and can we guarantee data isolation between users?

### **Time Box:** 2 days max

### **Tasks:**

#### 1.1 Create Test Database (30 min)
- [ ] Copy production schema to `partyplaylist_test`
- [ ] Load sample data from current production DB
- [ ] Verify test database matches production structure

#### 1.2 Design & Apply Schema Changes (3 hours)
- [ ] Create migration script for new tables:
  - `users` table
  - `events` table
  - `display_tokens` table
- [ ] Add columns to existing tables:
  - `requests` → add `user_id`, `event_id`
  - `settings` → add `user_id`
- [ ] Add indexes for performance:
  - `idx_requests_user_id`
  - `idx_requests_event_id`
  - `idx_settings_user_id`
- [ ] Apply to test database

#### 1.3 Create Test Data (1 hour)
- [ ] Create 3 test users: `johnsmith`, `janedoe`, `testdj`
- [ ] Create 1 active event for each user
- [ ] Create 5 requests per user (15 total)
- [ ] Verify data is properly isolated

#### 1.4 Test Data Isolation Queries (2 hours)
Write and test queries that will be used in production:

```sql
-- Test 1: Get requests for specific user
SELECT * FROM requests WHERE user_id = 'user-1-uuid';

-- Test 2: Get active event for user
SELECT * FROM events WHERE user_id = 'user-1-uuid' AND active = true;

-- Test 3: Count requests per user (should not cross-contaminate)
SELECT user_id, COUNT(*) FROM requests GROUP BY user_id;

-- Test 4: Verify unique constraint (one active event per user)
-- Try inserting second active event for same user (should fail)

-- Test 5: Foreign key cascades (delete user → deletes their requests?)
```

- [ ] All queries return correct, isolated data
- [ ] No cross-contamination between users
- [ ] Performance is acceptable (< 100ms for typical queries)

#### 1.5 Test Connection Pooling (2 hours)
Simulate multiple concurrent users:

- [ ] Install `pgbench` or equivalent load testing tool
- [ ] Configure connection pool (min: 10, max: 50)
- [ ] Run 50 concurrent queries from different "users"
- [ ] Monitor: connection pool exhaustion, query times, deadlocks
- [ ] Verify: No query returns wrong user's data under load

#### 1.6 Create Rollback Plan (1 hour)
- [ ] Document rollback SQL script
- [ ] Test rollback on test database
- [ ] Verify can revert to original schema

### **Success Criteria:**
✅ Migration script runs without errors  
✅ All data isolation queries pass  
✅ No cross-contamination under concurrent load  
✅ Performance acceptable (queries < 100ms)  
✅ Rollback script works  

### **Failure Scenarios & Mitigations:**
❌ **Foreign key conflicts** → Adjust cascade rules or add soft deletes  
❌ **Performance issues** → Add more indexes or denormalize  
❌ **Connection pool exhaustion** → Increase pool size or add connection retry logic  

### **Deliverables:**
1. ✅ Validated migration script (`migrations/001-add-multi-tenancy.sql`)
2. ✅ Test results document showing query performance
3. ✅ Connection pooling configuration
4. ✅ Rollback script

---

## 🔐 Spike 2: Authentication & Route Protection

### **Question to Answer:**
Can we enforce that users can only access their own `/:username/*` routes, and can middleware reliably prevent cross-user access?

### **Time Box:** 1 day max

### **Tasks:**

#### 2.1 Implement JWT Authentication (2 hours)
- [ ] Install `jsonwebtoken` and `bcryptjs` packages
- [ ] Create JWT helper functions:
  - `generateToken(user)` → returns signed JWT
  - `verifyToken(token)` → returns decoded payload
- [ ] Create password hashing functions:
  - `hashPassword(plaintext)` → bcrypt hash
  - `comparePassword(plaintext, hash)` → boolean
- [ ] Test token generation and verification

#### 2.2 Create Auth Middleware (3 hours)
- [ ] Create `/middleware/auth.ts`:
  ```typescript
  // Verify JWT token from cookie
  export function requireAuth(req, res, next)
  
  // Verify username in URL matches JWT username
  export function requireOwnResource(req, res, next)
  
  // Verify user is super admin
  export function requireSuperAdmin(req, res, next)
  ```
- [ ] Implement each middleware function
- [ ] Add error handling (401, 403)

#### 2.3 Create Test Routes (1 hour)
Set up test routes to validate middleware:

- [ ] `POST /api/test/login` - Returns JWT for test users
- [ ] `GET /api/test/:username/protected` - Requires auth + username match
- [ ] `GET /api/test/superadmin-only` - Requires super admin role

#### 2.4 Test Authorization Scenarios (2 hours)
Run through all access control scenarios:

**Test 1: Successful Authentication**
- [ ] User logs in → receives JWT cookie
- [ ] User accesses their own route → 200 OK

**Test 2: Cross-User Access Prevention**
- [ ] UserA logs in
- [ ] UserA tries to access `/api/userb/requests` → 403 Forbidden
- [ ] Middleware logs attempted unauthorized access

**Test 3: Token Expiry**
- [ ] Generate token with 1-second expiry
- [ ] Wait 2 seconds
- [ ] Request with expired token → 401 Unauthorized

**Test 4: Invalid Token**
- [ ] Send request with malformed JWT → 401 Unauthorized
- [ ] Send request with no JWT → 401 Unauthorized

**Test 5: Super Admin Override**
- [ ] Super admin can access any user's routes
- [ ] Regular user cannot access super admin routes

**Test 6: URL Parameter Injection**
- [ ] UserA tries `/api/../userb/requests` → Blocked
- [ ] UserA tries `/api/userb%2F../usera/requests` → Blocked

#### 2.5 Performance Test (1 hour)
- [ ] Send 1000 requests through middleware
- [ ] Measure latency: JWT verification should add < 5ms
- [ ] Monitor for memory leaks

### **Success Criteria:**
✅ JWT generation and verification work correctly  
✅ Users can only access their own `/:username/*` routes  
✅ Cross-user access attempts are blocked (403)  
✅ Super admin can access all routes  
✅ Middleware adds < 5ms latency  
✅ No security bypasses found in testing  

### **Failure Scenarios & Mitigations:**
❌ **JWT overhead too high** → Use shorter tokens or cache decoded tokens  
❌ **Middleware bypass found** → Add additional validation layers  
❌ **Cookie issues across domains** → Adjust cookie settings (sameSite, secure)  

### **Deliverables:**
1. ✅ Working auth middleware (`/middleware/auth.ts`)
2. ✅ JWT helper functions (`/lib/auth.ts`)
3. ✅ Test results showing all scenarios pass
4. ✅ Performance benchmark results

---

## 🎵 Spike 3: Spotify Multi-Tenancy

### **Question to Answer:**
Can multiple users connect their own Spotify accounts and use them simultaneously without interference?

### **Time Box:** 2 days max

### **Tasks:**

#### 3.1 Review Current Spotify Architecture (1 hour)
- [ ] Document current Spotify integration:
  - Where tokens are stored (currently global?)
  - How Spotify watcher works
  - How Spotify API calls are made
- [ ] Identify changes needed for per-user tokens

#### 3.2 Implement Per-User Token Storage (2 hours)
- [ ] Update database schema (already in Spike 1):
  ```sql
  -- Add to users table
  spotify_access_token TEXT
  spotify_refresh_token TEXT
  spotify_token_expires_at TIMESTAMP
  ```
- [ ] Create functions:
  - `getSpotifyToken(userId)` → returns valid access token (refreshes if needed)
  - `saveSpotifyToken(userId, tokens)` → stores tokens
  - `revokeSpotifyToken(userId)` → removes tokens

#### 3.3 Modify Spotify Service for Multi-Tenancy (4 hours)
- [ ] Update `spotifyService` to accept `userId` parameter:
  ```typescript
  // Before: spotifyService.getCurrentPlayback()
  // After:  spotifyService.getCurrentPlayback(userId)
  ```
- [ ] Update all Spotify API calls to use user-specific tokens
- [ ] Test with 2 different Spotify accounts

#### 3.4 Test Multi-User Spotify Watcher (4 hours)
This is the most critical test:

**Scenario 1: Single User Active**
- [ ] User1 has active event
- [ ] Spotify watcher tracks User1's playback
- [ ] Now-playing updates correctly

**Scenario 2: Two Users Active Simultaneously**
- [ ] User1 has active event (playing Track A on Spotify Account 1)
- [ ] User2 has active event (playing Track B on Spotify Account 2)
- [ ] Start both Spotify watchers
- [ ] Verify:
  - User1's display shows Track A
  - User2's display shows Track B
  - No cross-contamination
  - Both watchers run without interfering

**Scenario 3: Token Expiry (User1 only)**
- [ ] Expire User1's Spotify token
- [ ] Verify:
  - User1's watcher stops gracefully
  - User2's watcher continues normally
  - User1 sees "Reconnect Spotify" message
  - User2 unaffected

**Scenario 4: Rate Limiting**
- [ ] Simulate 5 active users with watchers
- [ ] Monitor Spotify API rate limits
- [ ] Verify no 429 errors (rate limit exceeded)
- [ ] If 429 errors occur, implement backoff strategy

#### 3.5 Test Spotify OAuth Flow Per-User (2 hours)
- [ ] User1 visits `/:username/admin/spotify`
- [ ] Clicks "Connect Spotify"
- [ ] Completes OAuth flow
- [ ] Tokens stored with User1's `user_id`
- [ ] Repeat for User2
- [ ] Verify both users have separate tokens in database

#### 3.6 Performance & Scaling Test (2 hours)
- [ ] Run 10 concurrent Spotify watchers (simulating 10 active events)
- [ ] Monitor:
  - API call frequency (should respect rate limits)
  - Memory usage (should not leak)
  - CPU usage
  - Database query load
- [ ] Calculate max concurrent users before performance degrades

### **Success Criteria:**
✅ Multiple users can connect their own Spotify accounts  
✅ Spotify watchers run independently without interference  
✅ Token expiry for one user doesn't affect others  
✅ No rate limiting issues with 5+ concurrent users  
✅ OAuth flow works per-user  
✅ Performance acceptable with 10 concurrent events  

### **Failure Scenarios & Mitigations:**
❌ **Spotify rate limits hit with 5+ users** → Implement smarter polling (only when needed) or upgrade Spotify API tier  
❌ **Watchers interfere with each other** → Isolate watcher instances per user (separate processes or workers)  
❌ **Token refresh race conditions** → Add locking mechanism for token refresh  
❌ **Memory leaks with multiple watchers** → Investigate and fix event listener cleanup  

### **Deliverables:**
1. ✅ Multi-tenant Spotify service (`/lib/spotify-multi-tenant.ts`)
2. ✅ Per-user token storage functions
3. ✅ Test results showing 2+ users with separate Spotify accounts
4. ✅ Performance report: max concurrent users before degradation
5. ✅ Rate limiting strategy document

---

## 📊 Spike Results & Decision Matrix

After completing all spikes, evaluate results:

### **All Spikes Pass ✅**
- Proceed with full implementation starting with **Vertical Slice 1**
- Use validated architecture from spikes
- Estimated timeline: 5-6 weeks

### **One Spike Fails ⚠️**
- **Spike 1 (Database) fails:**
  - Consider different isolation strategy (schemas per user, separate DBs)
  - May require PRD revision
  
- **Spike 2 (Auth) fails:**
  - Investigate alternative auth strategies (session-based, OAuth)
  - May require different routing approach
  
- **Spike 3 (Spotify) fails:**
  - Most likely: rate limiting or watcher interference
  - Mitigations: Smarter polling, upgrade Spotify tier, queue-based architecture

### **Multiple Spikes Fail ❌**
- Re-evaluate entire multi-tenant approach
- Consider alternative architectures:
  - Separate deployments per user (overkill for your scale)
  - Hybrid approach (some shared, some isolated)
- Schedule architecture review meeting

---

## 🚀 Quick Start: Begin Spike 1 TODAY

### **What You Need:**
1. Access to production database (read-only)
2. Ability to create test database
3. ~4 hours of focused time

### **Steps to Start Now:**

```bash
# 1. Create test database
createdb partyplaylist_test

# 2. Copy production schema
pg_dump --schema-only partyplaylist | psql partyplaylist_test

# 3. Create spike branch
git checkout -b spike/database-multi-tenant

# 4. Create migration file
mkdir -p migrations
touch migrations/001-add-multi-tenancy.sql

# 5. Start writing migration
# (I can help with this!)
```

### **By End of Day:**
- ✅ Test database created
- ✅ Migration script written (at least tables)
- ✅ Initial schema applied and tested
- 🎯 Tomorrow: Data isolation testing

---

## 📝 Notes & Considerations

### **Parallel Work Possible:**
- Spike 1 (Database) and Spike 2 (Auth) can run in parallel on Day 2-3
- One developer can work on database while another works on auth
- This could compress timeline to 3 days instead of 5

### **Risk Mitigation:**
Each spike is time-boxed. If you hit the time limit and haven't reached success criteria, **stop and evaluate**. Don't let spikes turn into full implementations.

### **Documentation:**
As you complete each spike, document:
- What worked
- What didn't work
- Decisions made
- Code/configuration to reuse in full implementation

### **Low Risk to Codebase:**
All spike work is in:
- Test database (not production)
- Spike branch (not main)
- Test routes (can be deleted)

If a spike fails, you've only invested a few days, not weeks.

---

## ✅ Spike Completion Checklist

Before proceeding to full implementation:

- [ ] All 3 spikes completed within time boxes
- [ ] Success criteria met for each spike
- [ ] Deliverables documented and saved
- [ ] Architecture decisions documented
- [ ] Any PRD adjustments made based on learnings
- [ ] Team aligned on proceeding with full implementation
- [ ] Migration scripts ready for production (from Spike 1)
- [ ] Auth middleware ready to use (from Spike 2)
- [ ] Spotify multi-tenant service ready (from Spike 3)

---

## 🎯 After Spikes: Vertical Slice Development

Once spikes pass, proceed with vertical slice implementation:

1. **Slice 1:** Super Admin Creates User + Login (Week 1)
2. **Slice 2:** User Creates Event + QR Code (Week 2)
3. **Slice 3:** Guest Submits Request (Week 2-3)
4. **Slice 4:** Display Page Auth (Week 3)
5. **Slice 5:** Per-User Spotify (Week 4)
6. **Slice 6:** Homepage + Contact (Week 4-5)

Each slice builds on validated architecture from spikes.

---

**Ready to begin Spike 1? I can start generating the migration script right now.** 🚀
