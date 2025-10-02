# Codebase Optimization Plan

## Phase 2.1: Remove Obsolete API Endpoints

### Old Endpoints to Delete (No longer used):
1. **`src/app/api/party-status/route.ts`** - Replaced by `/api/event/status`
2. **`src/app/api/admin/login-status/route.ts`** - Authentication now handled by JWT/AdminAuthContext
3. **`src/app/api/admin/page-controls/route.ts`** - Replaced by `/api/event/pages`

**Verification**: All state is now managed by `GlobalEventProvider` which uses:
- `/api/event/status` (GET/POST for event status)
- `/api/event/pages` (POST for page controls)

---

## Phase 2.2: Clean Up AdminLayout.tsx

### Current Issues:
- **617 lines** of code (way too large!)
- Contains old page control logic (lines 37-183) - **REMOVE**
- Duplicate Pusher listeners - **REMOVE**
- Old fetch calls to deprecated endpoints - **REMOVE**

### What to Keep:
- Login/Logout functionality (lines 184-253)
- Navigation (lines 380-520)
- Layout structure

### What to Remove:
- `pageControls` state management (line 37-40)
- `togglingPage` state (line 41)
- `fetchPageControls()` function (lines 110-133)
- `togglePageControl()` function (lines 136-183)
- Pusher integration for page controls (lines 48-56)
- Old page control buttons in navbar (already removed)

**Estimated reduction**: ~617 → ~350 lines (43% reduction)

---

## Phase 2.3: Remove Duplicate Pusher Code

### Files with Old Pusher Integration:
1. **`src/components/AdminLayout.tsx`** - Has usePusher hook for page controls (REMOVE)
2. **`src/app/display/page.tsx`** - Has usePusher hook with old handlers (CLEAN UP)

**Note**: `GlobalEventProvider` is now the SINGLE source of truth for Pusher events.

---

## Phase 2.4: Clean Up Debug Logging

### Files with Excessive Debug Logs:
1. **`src/lib/state/global-event-client.tsx`** - 20+ console.log statements
2. **`src/components/admin/PageControlPanel.tsx`** - 10+ console.log statements
3. **`src/app/api/event/pages/route.ts`** - 15+ console.log statements
4. **`src/app/page.tsx`** - Debug useEffect with state logging
5. **`src/app/display/page.tsx`** - Debug useEffect with state logging

**Strategy**: Keep only ERROR and CRITICAL logs, remove SUCCESS/INFO logs.

---

## Phase 2.5: Remove Unused Imports

Run automated cleanup to remove:
- Unused icon imports (e.g., `Wifi`, `WifiOff` already removed from StateControlPanel)
- Unused React hooks
- Unused utility functions

---

## Estimated Impact:
- **Lines of code reduced**: ~500-700 lines
- **Bundle size reduction**: ~10-15%
- **Maintenance burden**: Significantly reduced
- **Performance**: Slight improvement (fewer re-renders, less logging)

