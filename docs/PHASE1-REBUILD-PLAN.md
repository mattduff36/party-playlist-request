# Phase 1: Admin Pages Rebuild Plan

## 🎯 Goal
Rebuild admin pages from scratch using NEW multi-tenant architecture, while preserving existing UI/UX and features.

## ✅ What's Working (Keep As-Is)
- JWT Authentication (layout wrapper)
- Event system (PIN, bypass tokens, display tokens)
- EventInfoPanel component
- Public pages (request/display with auth stubs)
- Database multi-tenancy

## 🔨 Pages to Rebuild

### 1. `/[username]/admin/overview` ⭐ **PRIORITY**
**Reference:** `src/app/admin/overview/page.tsx` (main branch)

**Keep:**
- Visual layout (panels side-by-side, then full-width)
- StateControlPanel component
- PageControlPanel component
- SpotifyStatusDisplay component
- RequestManagementPanel component
- Spotify OAuth callback handling

**Change:**
- Remove AdminAuthContext usage
- Remove old admin token logic
- Use JWT user context from layout
- Filter all data by current user's user_id
- Use new event system for event info

**New Additions:**
- EventInfoPanel at the top (already added ✅)

---

### 2. `/[username]/admin/requests`
**Reference:** `src/app/admin/requests/page.tsx` (main branch)

**Keep:**
- RequestsTab UI component
- Filter controls (pending/approved/rejected/played/all)
- Action buttons (approve, reject, delete, re-submit)
- Mobile-responsive design

**Change:**
- Remove AdminAuthContext usage
- Filter requests by user_id from JWT
- Update API calls to use user-scoped endpoints

---

### 3. `/[username]/admin/settings`
**Reference:** `src/app/admin/settings/page.tsx` (main branch)

**Keep:**
- Settings form UI
- Spotify connection button
- Event settings (title, request limit, auto-approve, etc.)

**Change:**
- Remove AdminAuthContext usage
- Store settings per-user in user_settings table
- Update API calls to use user-scoped endpoints

---

### 4. `/[username]/admin/spotify`
**Reference:** `src/app/admin/spotify/page.tsx` (main branch)

**Keep:**
- "Coming Soon" placeholder (already correct ✅)

**Change:**
- Nothing needed (it's just a placeholder)

---

## 🔧 Backend Updates Needed

### API Endpoints to Update for Multi-Tenancy

1. **`/api/request`** - Add user_event_id
2. **`/api/admin/requests`** - Filter by user_id
3. **`/api/admin/approve/[id]`** - Verify ownership
4. **`/api/admin/reject/[id]`** - Verify ownership
5. **`/api/admin/delete/[id]`** - Verify ownership
6. **`/api/admin/stats`** - Filter by user_id
7. **`/api/event/status`** - Filter by user_id
8. **`/api/event/pages`** - Filter by user_id
9. **`/api/display/now-playing`** - Filter by user_id

### New Components Needed

1. ✅ **EventInfoPanel** - Shows PIN, QR codes, display token (DONE)
2. **UserRequestForm** - Request form for `/:username/request`
3. **UserDisplayContent** - Display content for `/:username/display`

---

## 📅 Implementation Order

### Tonight (Completed)
- ✅ JWT auth system
- ✅ Event system (PIN, tokens)
- ✅ Database migration
- ✅ EventInfoPanel
- ✅ Public page auth stubs

### Tomorrow (Phase 1 Completion)

**Morning Session:**
1. Rebuild `/[username]/admin/overview` page
2. Update backend APIs for multi-tenancy
3. Test full admin flow

**Afternoon Session:**
4. Rebuild `/[username]/admin/requests` page
5. Rebuild `/[username]/admin/settings` page
6. Integrate RequestForm into `/:username/request`
7. Integrate DisplayContent into `/:username/display`

**Evening Session:**
8. End-to-end testing
9. Bug fixes
10. Polish and documentation

---

## 🎨 Design Principles

1. **No AdminAuthContext** - All auth via JWT layout wrapper
2. **User-scoped data** - Every query filters by user_id
3. **Event-aware** - Use active event from event system
4. **Same UI/UX** - Preserve existing look and feel
5. **Clean code** - No legacy logic, fresh start

---

## 🚨 Key Differences from Old Code

| Old Approach | New Approach |
|--------------|--------------|
| AdminAuthContext | JWT in layout wrapper |
| Global event system | Per-user events |
| localStorage admin token | HTTP-only auth cookie |
| `/admin/*` routes | `/[username]/admin/*` routes |
| Single global state | User-scoped state |
| No PIN/tokens | PIN + bypass + display tokens |

---

## ✅ Success Criteria

- [ ] User can register and login
- [ ] User sees their own admin panel at `/:username/admin/overview`
- [ ] User can see event PIN and generate QR codes
- [ ] Public users can access `/:username/request` with PIN
- [ ] QR code bypass works (no PIN needed)
- [ ] Display page works with token
- [ ] All data is isolated per user
- [ ] UI looks identical to current admin pages
- [ ] All existing features work
- [ ] No legacy auth code remains

---

## 🎯 Tomorrow's Starting Point

**First task:** Rebuild Overview page cleanly
- Copy UI structure from old overview
- Use new architecture (JWT, events, user filtering)
- Test each panel independently
- Remove all AdminAuthContext references

