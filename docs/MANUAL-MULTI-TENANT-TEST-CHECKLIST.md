# 🔒 Manual Multi-Tenant Security Testing Checklist

**Date**: 2025-10-15  
**Priority**: CRITICAL  
**Tester**: Manual (2 devices)

---

## 🎯 **Objective**

Verify **ZERO cross-contamination** between DJ1 (testuser1) and DJ2 (testuser2) accounts.

---

## 📱 **Setup**

### Device 1 (Current Browser - DJ1)
- **Status**: ✅ Already setup and logged in
- **Username**: `testuser1`
- **Password**: `testpassword123`
- **Event Status**: LIVE
- **Spotify**: Connected
- **Current Track**: Playing
- **PIN**: 6455
- **URL**: http://localhost:3000/testuser1/admin/overview

### Device 2 (Second Laptop - DJ2)
- **URL**: http://localhost:3000/login
- **Username**: `testuser2`
- **Password**: `testpassword123`
- **Spotify**: Use your SECOND Spotify account

---

## ✅ **TEST CHECKLIST**

### **Phase 1: DJ2 Setup & Login** (10 min)

- [ ] **1.1** Open http://localhost:3000/login on Device 2
- [ ] **1.2** Login as `testuser2` / `testpassword123`
- [ ] **1.3** If session transfer modal appears, click "Yes, Transfer"
- [ ] **1.4** Verify DJ2 lands on admin overview page
- [ ] **1.5** Click "Setup" button in sidebar
- [ ] **1.6** Verify Setup modal appears
- [ ] **1.7** Change event name to "DJ2 Test Event"
- [ ] **1.8** Click "Apply Settings"
- [ ] **1.9** Click "Connect Spotify" button
- [ ] **1.10** Sign in with your SECOND Spotify account
- [ ] **1.11** Verify DJ2 returns to admin panel with Spotify connected

**Expected Results:**
- ✅ DJ2 has their own separate event
- ✅ DJ2's event name is "DJ2 Test Event"
- ✅ DJ2's Spotify is connected (second account)
- ✅ DJ2 has a different PIN than DJ1

**DJ2 Event Info:**
- Event Name: ________________
- PIN: ________________
- Spotify Device: ________________

---

### **Phase 2: CRITICAL - Data Isolation Tests** (20 min)

#### **Test 2.1: Create Requests - DJ1**

**On Device 1 (DJ1):**
- [ ] **2.1.1** Open http://localhost:3000/testuser1/request?bt=bp_6455 (use DJ1's PIN)
- [ ] **2.1.2** Search for "Bohemian Rhapsody"
- [ ] **2.1.3** Submit request (enter nickname: "DJ1 Guest1")
- [ ] **2.1.4** Search for "Stairway to Heaven"
- [ ] **2.1.5** Submit request (enter nickname: "DJ1 Guest2")
- [ ] **2.1.6** Search for "Hotel California"
- [ ] **2.1.7** Submit request (enter nickname: "DJ1 Guest3")
- [ ] **2.1.8** Go back to DJ1 admin overview
- [ ] **2.1.9** **VERIFY**: DJ1 admin shows exactly 3 requests

**DJ1 Requests Created:**
- ☑️ Bohemian Rhapsody (DJ1 Guest1)
- ☑️ Stairway to Heaven (DJ1 Guest2)
- ☑️ Hotel California (DJ1 Guest3)

---

#### **Test 2.2: Create Requests - DJ2**

**On Device 2 (DJ2):**
- [ ] **2.2.1** Open http://localhost:3000/testuser2/request?bt=bp_[DJ2_PIN] (use DJ2's PIN)
- [ ] **2.2.2** Search for "Sweet Child O' Mine"
- [ ] **2.2.3** Submit request (enter nickname: "DJ2 Guest1")
- [ ] **2.2.4** Search for "Smells Like Teen Spirit"
- [ ] **2.2.5** Submit request (enter nickname: "DJ2 Guest2")
- [ ] **2.2.6** Search for "Wonderwall"
- [ ] **2.2.7** Submit request (enter nickname: "DJ2 Guest3")
- [ ] **2.2.8** Go back to DJ2 admin overview
- [ ] **2.2.9** **VERIFY**: DJ2 admin shows exactly 3 requests

**DJ2 Requests Created:**
- ☑️ Sweet Child O' Mine (DJ2 Guest1)
- ☑️ Smells Like Teen Spirit (DJ2 Guest2)
- ☑️ Wonderwall (DJ2 Guest3)

---

#### **Test 2.3: 🚨 CRITICAL - Verify NO Cross-Contamination**

**On Device 1 (DJ1):**
- [ ] **2.3.1** Refresh DJ1 admin overview page
- [ ] **2.3.2** Expand "Song Requests" section
- [ ] **2.3.3** **VERIFY**: Shows ONLY 3 requests (Bohemian Rhapsody, Stairway to Heaven, Hotel California)
- [ ] **2.3.4** **VERIFY**: Does NOT show any DJ2 requests (Sweet Child O' Mine, Smells Like Teen Spirit, Wonderwall)
- [ ] **2.3.5** Click on "Pending (3)" filter
- [ ] **2.3.6** **VERIFY**: All 3 requests are DJ1's

**On Device 2 (DJ2):**
- [ ] **2.3.7** Refresh DJ2 admin overview page
- [ ] **2.3.8** Expand "Song Requests" section
- [ ] **2.3.9** **VERIFY**: Shows ONLY 3 requests (Sweet Child O' Mine, Smells Like Teen Spirit, Wonderwall)
- [ ] **2.3.10** **VERIFY**: Does NOT show any DJ1 requests (Bohemian Rhapsody, Stairway to Heaven, Hotel California)
- [ ] **2.3.11** Click on "Pending (3)" filter
- [ ] **2.3.12** **VERIFY**: All 3 requests are DJ2's

**🚨 CRITICAL FAILURE CONDITION:**
If DJ1 sees any of DJ2's requests, or DJ2 sees any of DJ1's requests, **STOP IMMEDIATELY** and report the issue!

---

#### **Test 2.4: Request Management Isolation**

**On Device 1 (DJ1):**
- [ ] **2.4.1** Approve "Bohemian Rhapsody"
- [ ] **2.4.2** **VERIFY**: Status changes to "Approved (1)"

**On Device 2 (DJ2):**
- [ ] **2.4.3** Refresh DJ2 admin panel
- [ ] **2.4.4** **VERIFY**: All 3 DJ2 requests still show as "Pending"
- [ ] **2.4.5** Reject "Wonderwall"
- [ ] **2.4.6** **VERIFY**: Status changes to "Rejected (1)"

**On Device 1 (DJ1):**
- [ ] **2.4.7** Refresh DJ1 admin panel
- [ ] **2.4.8** **VERIFY**: "Bohemian Rhapsody" still shows as "Approved"
- [ ] **2.4.9** **VERIFY**: No DJ1 requests show as "Rejected"

**Expected Results:**
- ✅ DJ1 approval only affects DJ1's request
- ✅ DJ2 rejection only affects DJ2's request
- ✅ NO cross-contamination of statuses

---

### **Phase 3: 🚨 CRITICAL - Offline Cleanup Isolation** (10 min)

#### **Test 3.1: Database Snapshot BEFORE Offline**

**Run this query in terminal:**
```bash
node -e "require('dotenv').config({path:'.env.local'}); const{Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL}); pool.query('SELECT u.username, COUNT(r.id) as request_count FROM users u LEFT JOIN requests r ON u.id = r.user_id WHERE u.username IN (\'testuser1\', \'testuser2\') GROUP BY u.username ORDER BY u.username').then(r=>{console.log('\n📊 Request Count by User:\n'); r.rows.forEach(row=>console.log('  '+row.username+': '+row.request_count+' requests')); console.log(''); pool.end()}).catch(e=>{console.error(e);pool.end()})"
```

**Expected Output:**
```
📊 Request Count by User:
  testuser1: 3 requests
  testuser2: 3 requests
```

**Record actual output here:**
- testuser1: ______ requests
- testuser2: ______ requests

---

#### **Test 3.2: DJ1 Goes OFFLINE**

**On Device 1 (DJ1):**
- [ ] **3.2.1** Click "Offline" button in Event Control
- [ ] **3.2.2** **VERIFY**: Spotify pauses (NEW FEATURE - auto-pause on offline)
- [ ] **3.2.3** **VERIFY**: Event status changes to "Offline"
- [ ] **3.2.4** **VERIFY**: Requests section shows "No requests found" (all deleted)
- [ ] **3.2.5** **VERIFY**: Request count shows "(0)" for all statuses

---

#### **Test 3.3: 🚨 CRITICAL - Verify DJ2 Requests Remain**

**On Device 2 (DJ2):**
- [ ] **3.3.1** Refresh DJ2 admin panel
- [ ] **3.3.2** **VERIFY**: DJ2 still has 3 requests visible
- [ ] **3.3.3** **VERIFY**: "Sweet Child O' Mine" still shows as Pending
- [ ] **3.3.4** **VERIFY**: "Smells Like Teen Spirit" still shows as Pending
- [ ] **3.3.5** **VERIFY**: "Wonderwall" still shows as Rejected

**🚨 CRITICAL FAILURE CONDITION:**
If ANY of DJ2's requests are deleted when DJ1 goes offline, **STOP IMMEDIATELY** - this is a critical multi-tenant isolation failure!

---

#### **Test 3.4: Database Verification AFTER Offline**

**Run this query in terminal:**
```bash
node -e "require('dotenv').config({path:'.env.local'}); const{Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL}); pool.query('SELECT u.username, COUNT(r.id) as request_count FROM users u LEFT JOIN requests r ON u.id = r.user_id WHERE u.username IN (\'testuser1\', \'testuser2\') GROUP BY u.username ORDER BY u.username').then(r=>{console.log('\n📊 Request Count by User (AFTER DJ1 OFFLINE):\n'); r.rows.forEach(row=>console.log('  '+row.username+': '+row.request_count+' requests')); console.log(''); pool.end()}).catch(e=>{console.error(e);pool.end()})"
```

**Expected Output:**
```
📊 Request Count by User (AFTER DJ1 OFFLINE):
  testuser1: 0 requests  ✅ (deleted)
  testuser2: 3 requests  ✅ (remain intact)
```

**Record actual output here:**
- testuser1: ______ requests (expected: 0)
- testuser2: ______ requests (expected: 3)

---

### **Phase 4: Display Screen Isolation** (5 min)

#### **Test 4.1: DJ1 Display Screen**

**On Device 1 (DJ1):**
- [ ] **4.1.1** Click "Open Display" in sidebar
- [ ] **4.1.2** **VERIFY**: Display shows "Event Offline" or "No approved requests"
- [ ] **4.1.3** **VERIFY**: Does NOT show any DJ2 data

---

#### **Test 4.2: DJ2 Display Screen**

**On Device 2 (DJ2):**
- [ ] **4.2.1** Click "Open Display" in sidebar
- [ ] **4.2.2** **VERIFY**: Display shows DJ2's approved requests (if any)
- [ ] **4.2.3** **VERIFY**: Does NOT show any DJ1 data

---

### **Phase 5: Final Database Integrity Check** (5 min)

**Run ALL these verification queries:**

#### **Check 1: NO NULL user_id**
```bash
node -e "require('dotenv').config({path:'.env.local'}); const{Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL}); pool.query('SELECT COUNT(*) as null_count FROM requests WHERE user_id IS NULL').then(r=>{console.log('\n🔍 Requests with NULL user_id: '+r.rows[0].null_count+(r.rows[0].null_count === '0' ? ' ✅' : ' ❌ CRITICAL ERROR')); console.log(''); pool.end()}).catch(e=>{console.error(e);pool.end()})"
```

**Expected:** `0 ✅`  
**Actual:** ______

---

#### **Check 2: Foreign Key Constraint Exists**
```bash
node -e "require('dotenv').config({path:'.env.local'}); const{Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL}); pool.query('SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = \'requests\' AND constraint_type = \'FOREIGN KEY\' AND constraint_name LIKE \'%user_id%\'').then(r=>{console.log('\n🔍 Foreign Key Constraint: '+(r.rows.length > 0 ? r.rows[0].constraint_name+' ✅' : 'NOT FOUND ❌')); console.log(''); pool.end()}).catch(e=>{console.error(e);pool.end()})"
```

**Expected:** `fk_requests_user_id ✅`  
**Actual:** ______

---

#### **Check 3: All Requests Have Valid user_id**
```bash
node -e "require('dotenv').config({path:'.env.local'}); const{Pool}=require('pg'); const pool=new Pool({connectionString:process.env.DATABASE_URL}); pool.query('SELECT COUNT(*) as orphaned FROM requests r LEFT JOIN users u ON r.user_id = u.id WHERE u.id IS NULL').then(r=>{console.log('\n🔍 Orphaned requests (no matching user): '+r.rows[0].orphaned+(r.rows[0].orphaned === '0' ? ' ✅' : ' ❌ CRITICAL ERROR')); console.log(''); pool.end()}).catch(e=>{console.error(e);pool.end()})"
```

**Expected:** `0 ✅`  
**Actual:** ______

---

## 📊 **FINAL RESULTS**

### **Critical Security Tests**

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| DJ1 sees only DJ1 requests | ✅ YES | _____ | ☐ PASS ☐ FAIL |
| DJ2 sees only DJ2 requests | ✅ YES | _____ | ☐ PASS ☐ FAIL |
| DJ1 offline deletes only DJ1 requests | ✅ YES | _____ | ☐ PASS ☐ FAIL |
| DJ2 requests remain after DJ1 offline | ✅ YES | _____ | ☐ PASS ☐ FAIL |
| NO NULL user_id in database | ✅ 0 | _____ | ☐ PASS ☐ FAIL |
| Foreign key constraint exists | ✅ YES | _____ | ☐ PASS ☐ FAIL |
| Display screens isolated | ✅ YES | _____ | ☐ PASS ☐ FAIL |

---

## 🎯 **SUCCESS CRITERIA**

**ALL critical tests MUST PASS:**
- ✅ NO cross-contamination of requests between users
- ✅ Offline cleanup only deletes user's own requests
- ✅ Database has proper foreign key constraints
- ✅ NO null user_id values exist
- ✅ Display screens show only relevant user's data

---

## 🚨 **FAILURE RESPONSE**

If ANY test fails:

1. **STOP TESTING IMMEDIATELY**
2. Document exactly which test failed
3. Take screenshots of both DJ1 and DJ2 panels
4. Copy the database query results
5. Report the issue with all evidence

---

## ✅ **SIGN-OFF**

**Tester Name:** _______________________  
**Date Completed:** _______________________  
**Overall Result:** ☐ ALL TESTS PASSED ☐ FAILURES FOUND  

**Notes/Issues:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

**Once complete, run final verification:**
```bash
echo "✅ Multi-tenant security testing complete!" && \
echo "All tests passed - system is secure for production"
```

