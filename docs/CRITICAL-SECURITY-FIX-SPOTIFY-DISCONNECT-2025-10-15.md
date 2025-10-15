# 🚨 CRITICAL SECURITY FIX: Spotify Disconnect Multi-Tenant Isolation

**Date:** October 15, 2025  
**Severity:** CRITICAL  
**Status:** FIXED ✅

---

## 📋 **Summary**

A critical multi-tenant isolation vulnerability was discovered in the Spotify disconnect functionality. When one user disconnected their Spotify account, it would **disconnect ALL users' Spotify accounts** in the system.

---

## 🔍 **Discovery**

**Discovered during:** Multi-tenant security testing (testuser1 vs testuser2)  
**Test scenario:** testuser1 set event to OFFLINE (which triggers Spotify disconnect)  
**Result:** testuser2's Spotify account was immediately disconnected

---

## 🐛 **Root Cause**

### **File: `src/app/api/spotify/disconnect/route.ts` (Line 20)**

**BEFORE (VULNERABLE):**
```typescript
await clearSpotifyAuth();  // ❌ NO userId passed!
```

The disconnect endpoint was calling `clearSpotifyAuth()` **without passing the `userId`**.

---

### **File: `src/lib/db.ts` (Lines 731-740)**

**BEFORE (VULNERABLE):**
```typescript
export async function clearSpotifyAuth(userId?: string): Promise<void> {
  const client = getPool();
  
  if (userId) {
    await client.query('DELETE FROM spotify_auth WHERE user_id = $1', [userId]);
  } else {
    // Fallback for single-tenant compatibility
    await client.query('DELETE FROM spotify_auth');  // ❌ DELETES ALL USERS!
  }
}
```

When `userId` was NOT provided (optional parameter), the function would execute:
```sql
DELETE FROM spotify_auth  -- No WHERE clause = ALL rows deleted!
```

---

## ✅ **Fix Applied**

### **1. Updated API Endpoint**

**File: `src/app/api/spotify/disconnect/route.ts`**

**AFTER (SECURE):**
```typescript
await clearSpotifyAuth(userId); // Multi-tenant: Pass userId to only disconnect this user
```

---

### **2. Made userId Required**

**File: `src/lib/db.ts`**

**AFTER (SECURE):**
```typescript
export async function clearSpotifyAuth(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('userId is required for multi-tenant data isolation');
  }
  
  const client = getPool();
  await client.query('DELETE FROM spotify_auth WHERE user_id = $1', [userId]);
}
```

**Changes:**
1. ✅ Made `userId` a **required parameter** (removed `?`)
2. ✅ Added explicit validation that throws an error if `userId` is missing
3. ✅ Removed the dangerous fallback that deleted ALL Spotify auth records
4. ✅ Added multi-tenant isolation comment for clarity

---

## 🧪 **Testing**

**Before Fix:**
- testuser1 goes OFFLINE → testuser2's Spotify disconnects ❌

**After Fix:**
- testuser1 goes OFFLINE → only testuser1's Spotify disconnects ✅
- testuser2's Spotify remains connected ✅

---

## 🎯 **Impact**

**Affected Systems:**
- Spotify disconnect functionality (`/api/spotify/disconnect`)
- Event OFFLINE transition (which calls Spotify disconnect)

**Vulnerability Window:**
- All deployments before October 15, 2025

**Data Impact:**
- No data loss or corruption
- Only affected users' Spotify connection status
- Users could simply reconnect their Spotify accounts

---

## 📝 **Related Fixes**

This is the **second multi-tenant isolation vulnerability** fixed today:

1. ✅ **Requests table missing `user_id`** (Fixed earlier) - [SECURITY-FIX-COMPLETE-2025-10-15.md]
2. ✅ **Spotify disconnect affecting all users** (This fix)

---

## 🔒 **Security Recommendations**

1. ✅ **All database operations must require `userId`**
2. ✅ **Never use optional `userId` parameters for DELETE operations**
3. ✅ **Always test multi-tenant isolation before deployment**
4. ✅ **Review all "fallback for single-tenant" code patterns**

---

## ✅ **Status**

- **Vulnerability:** Identified ✅
- **Fix:** Applied ✅
- **Testing:** Passed ✅
- **Documentation:** Complete ✅
- **Ready for deployment:** YES ✅

