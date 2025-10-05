# Spike 1: Database Multi-Tenancy Testing

## ⚡ Quick Start (FASTEST PATH TO RESULTS)

### Option A: Test on Neon Branch (RECOMMENDED - Safest)

Neon allows database branching - perfect for testing!

```bash
# 1. Create a test branch in Neon Dashboard
# Go to: https://console.neon.tech/
# Click your project → Branches → Create Branch
# Name: spike-multi-tenant
# Branch from: main

# 2. Get the new branch connection string from Neon
# Copy the connection string (will be different from main)

# 3. Run migration on branch
psql "postgresql://neondb_owner:npg_u7JFeoIbUhG3@ep-red-sound-abigblx5-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&options=project%3Dep-red-sound-abigblx5-branch-test-12345" \
  -f migrations/spike/001-add-multi-tenancy-UP.sql

# 4. Run validation queries (see below)

# 5. If satisfied, delete branch from Neon dashboard
```

### Option B: Test Directly on Main Database (Use with caution!)

Only if you're comfortable rolling back:

```bash
# 1. Backup first (Neon does this automatically, but good practice)
# Go to Neon dashboard → Backups

# 2. Run UP migration
psql "$DATABASE_URL" -f migrations/spike/001-add-multi-tenancy-UP.sql

# 3. Test queries (see below)

# 4. Rollback when done
psql "$DATABASE_URL" -f migrations/spike/001-add-multi-tenancy-DOWN.sql
```

### Option C: Use Docker Postgres Locally (Most isolated)

```bash
# 1. Start local Postgres
docker run --name spike-postgres -e POSTGRES_PASSWORD=testpass -p 5433:5432 -d postgres:15

# 2. Copy schema from production
pg_dump "$DATABASE_URL" --schema-only | docker exec -i spike-postgres psql -U postgres

# 3. Run migration
docker exec -i spike-postgres psql -U postgres < migrations/spike/001-add-multi-tenancy-UP.sql

# 4. Test (see below)

# 5. Destroy container when done
docker stop spike-postgres && docker rm spike-postgres
```

---

## ✅ Validation Queries (Run After Migration)

### Test 1: Verify Data Isolation

```sql
-- Should show 3 requests for johnsmith, 2 for janedoe, 0 for testdj
SELECT u.username, COUNT(r.id) as request_count
FROM users u
LEFT JOIN requests r ON r.user_id = u.id
GROUP BY u.username
ORDER BY u.username;
```

**Expected output:**
```
  username   | request_count
-------------+---------------
 janedoe     |             2
 johnsmith   |             3
 superadmin  |             0
 testdj      |             0
```

### Test 2: Verify Active Events

```sql
SELECT u.username, e.name, e.pin, e.active, 
       (e.expires_at > NOW()) as still_valid
FROM users u
LEFT JOIN user_events e ON e.user_id = u.id AND e.active = true
ORDER BY u.username;
```

**Expected output:**
```
  username   |         name          | pin  | active | still_valid
-------------+-----------------------+------+--------+-------------
 janedoe     | Janes Wedding...      | 5812 | t      | t
 johnsmith   | Johns Birthday...     | 7429 | t      | t
 superadmin  | NULL                  | NULL | NULL   | NULL
 testdj      | NULL                  | NULL | NULL   | NULL
```

### Test 3: Check Cross-Contamination (Security Critical!)

```sql
-- This should return 0 - no requests belong to multiple users
SELECT COUNT(*) as cross_contamination_errors
FROM requests r1
INNER JOIN requests r2 ON r1.id = r2.id
WHERE r1.user_id != r2.user_id;
```

**Expected output:**
```
 cross_contamination_errors
----------------------------
                          0
```

### Test 4: Test Unique Active Event Constraint

```sql
-- This INSERT should FAIL with unique constraint violation
INSERT INTO user_events (user_id, name, pin, bypass_token, active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Second Event', '9999', 'test_token_should_fail', true);
```

**Expected:** ERROR with message like:
```
ERROR: duplicate key value violates unique constraint "one_active_event_per_user"
```

### Test 5: Performance - Index Usage

```sql
EXPLAIN ANALYZE
SELECT * FROM requests 
WHERE user_id = '11111111-1111-1111-1111-111111111111' 
  AND status = 'pending';
```

**Expected:** Query plan should show:
```
Index Scan using idx_requests_user_status on requests
```

### Test 6: Verify User Settings Isolation

```sql
SELECT u.username, us.key, us.value
FROM users u
LEFT JOIN user_settings us ON us.user_id = u.id
WHERE u.role = 'user'
ORDER BY u.username, us.key;
```

**Expected:** Each user has their own settings, no overlap.

---

## 🚨 Common Issues & Fixes

### Issue 1: "relation already exists"
**Cause:** Tables already created from previous test  
**Fix:** Run rollback script first:
```bash
psql "$DATABASE_URL" -f migrations/spike/001-add-multi-tenancy-DOWN.sql
```

### Issue 2: "column already exists"
**Cause:** Partial migration applied  
**Fix:** Check which columns exist:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'requests';
```
Then manually drop or adjust migration.

### Issue 3: Foreign key violations
**Cause:** Existing data doesn't match new constraints  
**Fix:** This is a test database, so safe to clear:
```sql
TRUNCATE requests, user_events, users CASCADE;
```

---

## 📊 Success Criteria Checklist

After running all validation queries:

- [ ] ✅ Migration script runs without errors
- [ ] ✅ Test data loaded (4 users, 2 active events, 5 requests)
- [ ] ✅ Data isolation verified (Test 1)
- [ ] ✅ Active events per user correct (Test 2)
- [ ] ✅ No cross-contamination (Test 3 returns 0)
- [ ] ✅ Unique constraint works (Test 4 fails as expected)
- [ ] ✅ Indexes are used (Test 5 shows index scan)
- [ ] ✅ Performance acceptable (queries < 100ms)
- [ ] ✅ Rollback script works (if tested)

---

## ⏱️ Time Tracking

Start time: _______
End time: _______
Total: _______ (Target: 2 hours for basic validation)

---

## 🎯 Next Steps After Spike 1 Passes

1. ✅ Mark Spike 1 as COMPLETE in spike plan
2. 🚀 Begin Spike 2: Authentication & Routing
3. 📝 Document any learnings or schema adjustments needed
4. 💾 Save validated migration script for production use

---

## 🆘 Need Help?

If any test fails or you're stuck:
1. Check error message carefully
2. Verify DATABASE_URL is correct
3. Ensure Postgres version is 12+ (Neon uses 15)
4. Check Neon dashboard for query logs

---

**Good luck! This should take 1-2 hours max.** 🚀
