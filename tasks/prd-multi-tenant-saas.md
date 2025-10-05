# PRD: Multi-Tenant SaaS Transformation

**Feature Name:** Multi-Tenant SaaS Platform  
**Status:** Draft  
**Created:** October 5, 2025  
**Target Audience:** Junior/Mid-Level Developers  
**Phase:** 1 (MVP)

---

## 1. Introduction/Overview

### Current State
PartyPlaylist currently operates as a single-tenant application with one admin account. All requests, settings, and Spotify connections are tied to a single global instance.

### Problem Statement
The current architecture prevents PartyPlaylist from being sold as a service to multiple DJs/event hosts. Each user needs:
- Their own isolated admin panel
- Their own Spotify account connection
- Their own public request page with security
- Their own display screen
- The ability to run events independently without interfering with other users

### Proposed Solution
Transform PartyPlaylist into a multi-tenant SaaS platform where:
1. Multiple users can register and manage their own accounts
2. Each user has a unique username-based URL structure (`/johnsmith`)
3. Events are protected by PIN authentication for public pages
4. Each user connects their own Spotify account
5. Data is completely isolated between users
6. Super admin can manage all users and platform health

### Goal
Enable PartyPlaylist to serve multiple paying customers simultaneously, each running their own independent events with complete data isolation and security.

---

## 2. Goals

1. **Multi-Tenancy**: Support unlimited users on a single platform instance with complete data isolation
2. **Security**: Prevent unauthorized access to user-specific pages using PIN authentication and tokens
3. **Monetization**: Integrate Stripe for payments with multiple pricing models (one-off, subscription, custom)
4. **Scalability**: Design database and architecture to support future features (multiple concurrent events per user)
5. **User Experience**: Maintain simple, clean URLs and seamless QR code experience for event guests
6. **Admin Control**: Provide super admin panel to manage users, monitor platform health, and manually add accounts

---

## 3. User Stories

### End Users (Event Guests)
1. **As a party guest**, I want to scan a QR code and immediately request songs without any login, so that I can quickly add my favorite music.
2. **As a party guest visiting manually**, I want to enter a simple 4-digit PIN to access the request form, so that I can request songs even if I can't scan the QR code.
3. **As a party guest**, I want to see what's currently playing on a display screen, so that I know what song is playing and what's coming up next.

### DJs/Event Hosts (Users)
1. **As a DJ**, I want to register for an account and connect my Spotify, so that I can use PartyPlaylist at my events.
2. **As a DJ**, I want to start a new event with a unique PIN, so that only guests at my venue can submit requests.
3. **As a DJ**, I want to generate a QR code that bypasses PIN entry, so that guests can scan and request instantly.
4. **As a DJ**, I want to display my now-playing screen on a venue TV, so that guests can see the request code and current track.
5. **As a DJ**, I want to end my event when the party is over, so that guests can no longer submit requests.
6. **As a DJ**, I want my event to automatically expire after 24 hours, so that I don't have to remember to turn it off.
7. **As a DJ**, I want to choose between one-off event pricing or a subscription, so that I can pick the payment model that suits my needs.

### Platform Owner (Super Admin)
1. **As a super admin**, I want to view all registered users and their account status, so that I can manage the platform.
2. **As a super admin**, I want to manually create accounts for VIP customers without requiring payment, so that I can offer custom deals.
3. **As a super admin**, I want to activate/deactivate user accounts, so that I can manage subscriptions and cancellations.
4. **As a super admin**, I want to see basic platform statistics (total users, active events, request counts), so that I can monitor platform health.

---

## 4. Functional Requirements

### 4.1 User Registration & Authentication

**FR-1.1** The system must provide a public user registration page at `/register` where new users can create accounts.

**FR-1.2** User registration must collect:
- Email (unique, validated)
- Username (unique, alphanumeric + hyphens, 3-20 characters, used in URLs)
- Display name (shown to guests, e.g., "John Smith DJ Services")
- Password (minimum 8 characters, hashed with bcrypt)

**FR-1.3** Newly registered accounts must have status `pending` until approved by super admin and payment is received.

**FR-1.4** The system must provide a login page at `/login` with email and password fields.

**FR-1.5** Upon successful login, users must be redirected to `/:username/admin/overview`.

**FR-1.6** The system must use JWT tokens for authentication, stored in HTTP-only cookies.

**FR-1.7** JWT tokens must include `user_id`, `username`, `email`, and `role` claims.

**FR-1.8** Passwords must be hashed using bcrypt with a salt round of 12.

### 4.2 URL Structure & Routing

**FR-2.1** The homepage (`/`) must display a static landing page with:
- Brief description of PartyPlaylist
- Prominent [Login] button linking to `/login`
- [Contact Me] button linking to contact information

**FR-2.2** User-specific URLs must follow the pattern `/:username/*` where `:username` is the unique username.

**FR-2.3** Public pages (request form, display) must be accessible at:
- `/:username` - Request form (PIN-protected)
- `/:username/display` - Now playing display (token or auth-protected)

**FR-2.4** Admin pages must be accessible at:
- `/:username/admin/overview` - Dashboard
- `/:username/admin/requests` - Request management
- `/:username/admin/settings` - Event settings
- `/:username/admin/queue` - Spotify queue management
- `/:username/admin/spotify` - Spotify connection

**FR-2.5** Middleware must verify that the authenticated user's username matches the `:username` in the URL for admin routes.

**FR-2.6** Super admin pages must be accessible at:
- `/superadmin/dashboard` - Platform overview
- `/superadmin/users` - User management
- `/superadmin/users/new` - Create new user manually

### 4.3 Event System

**FR-3.1** Users must be able to start a new event from their admin panel.

**FR-3.2** When an event is created, the system must generate:
- A unique 4-digit PIN (0000-9999)
- A cryptographically secure bypass token (32 characters)
- An event ID (UUID)
- A start timestamp

**FR-3.3** Only ONE active event per user is allowed in Phase 1.

**FR-3.4** Events must automatically expire 24 hours after creation.

**FR-3.5** Users must be able to manually end events by clicking "Go Offline" or "End Event" button.

**FR-3.6** When an event ends (manual or auto), its status must change to `ended` and `active` flag set to `false`.

**FR-3.7** The admin panel must display:
- Current event status (Active/Offline)
- Current PIN (if active)
- Time remaining until auto-expiry
- Request count for current event
- [Start New Event] button (if no active event)
- [End Event] button (if active event)

### 4.4 PIN Authentication

**FR-4.1** When a guest visits `/:username` without a bypass token or valid session, they must see a PIN prompt screen.

**FR-4.2** The PIN prompt must display:
- User's display name
- Input field for 4-digit PIN
- "Submit" button
- Helpful message: "Enter the 4-digit code shown on the display screen at the venue"

**FR-4.3** When a guest submits a valid PIN, the system must store it in a session cookie scoped to `/:username/*`.

**FR-4.4** Session cookies must expire after 24 hours or when the event ends, whichever comes first.

**FR-4.5** Invalid PIN submissions must display an error: "Invalid code. Please check the display screen and try again."

**FR-4.6** PIN verification must be rate-limited to 5 attempts per IP address per 15 minutes to prevent brute force attacks.

### 4.5 QR Code & Bypass Tokens

**FR-5.1** The admin panel must provide a "Generate QR Code" button.

**FR-5.2** The generated QR code must encode: `https://partyplaylist.co.uk/:username?t=BYPASS_TOKEN`

**FR-5.3** When a guest visits the URL with a valid bypass token (`?t=...`), they must bypass PIN authentication.

**FR-5.4** Bypass tokens must be validated against the current active event.

**FR-5.5** QR codes must be downloadable as PNG images (300x300px minimum).

**FR-5.6** The admin panel must allow regenerating QR codes (which generates a new bypass token).

### 4.6 Display Page Authentication

**FR-6.1** The display page (`/:username/display`) must be protected by authentication.

**FR-6.2** If the user is logged in on the same device/browser, the display page must open without additional authentication.

**FR-6.3** If the user is not logged in, they must be able to generate a temporary display token from the admin panel.

**FR-6.4** The "Open Display on Another Device" button in admin must generate a URL: `/:username/display?dt=DISPLAY_TOKEN`

**FR-6.5** Display tokens must be valid for 24 hours from generation.

**FR-6.6** Display tokens must be single-use or limited to 3 uses to prevent sharing.

**FR-6.7** If a user tries to access another user's display page (e.g., UserA accessing `/userb/display`), the system must display:
- "You're logged in as UserA but trying to access UserB's display. [Switch Account]"

**FR-6.8** If no valid authentication is present, display page must show:
- "Display page is only accessible when logged in. Please open this page from your admin panel."
- [Go to Login] button

### 4.7 Request Form (Public)

**FR-7.1** The request form at `/:username` must be accessible only when:
- A valid bypass token is present in URL, OR
- A valid PIN is stored in session cookie, OR
- User is authenticated and viewing their own page

**FR-7.2** If no active event exists for the user, display:
- "No active event. Check back when [User Display Name] starts their next party!"

**FR-7.3** Request submissions must include `event_id` to associate with the correct event.

**FR-7.4** Request form must display user's branding:
- User's display name
- Custom welcome message (from settings)
- User's event title

### 4.8 Data Isolation

**FR-8.1** All database queries for requests must filter by `user_id`.

**FR-8.2** All database queries for settings must filter by `user_id`.

**FR-8.3** All database queries for events must filter by `user_id`.

**FR-8.4** Users must not be able to view or modify data belonging to other users under any circumstance.

**FR-8.5** API endpoints must verify user ownership before returning data.

**FR-8.6** Middleware must enforce that authenticated user can only access their own resources.

### 4.9 Spotify Multi-Tenancy

**FR-9.1** Each user must connect their own Spotify account.

**FR-9.2** Spotify OAuth flow must be per-user, accessed from `/:username/admin/spotify`.

**FR-9.3** Spotify tokens (access, refresh) must be stored per-user in the database.

**FR-9.4** Spotify API calls must use the requesting user's tokens, not a global token.

**FR-9.5** The Spotify watcher service must run independently for each active event/user.

**FR-9.6** If a user's Spotify token expires, only that user's functionality should be affected.

### 4.10 Payment Integration (Stripe)

**FR-10.1** The system must integrate Stripe for payment processing.

**FR-10.2** Three pricing models must be supported:
- **One-off Event**: Single payment for a single event (24-hour access)
- **Subscription**: Recurring monthly payment for unlimited events
- **Custom**: Manually configured pricing by super admin

**FR-10.3** Users with `pending` status must be redirected to a payment page after registration.

**FR-10.4** Upon successful payment, user status must change from `pending` to `active`.

**FR-10.5** Subscription payments must be handled via Stripe's subscription API.

**FR-10.6** Failed payments must change user status to `suspended`.

**FR-10.7** Super admin must be able to manually activate accounts without payment (for VIP/custom deals).

### 4.11 Super Admin Panel

**FR-11.1** Super admin panel must be accessible at `/superadmin/*`.

**FR-11.2** Only users with `role='superadmin'` in JWT can access super admin routes.

**FR-11.3** Super admin dashboard must display:
- Total registered users
- Active users (status='active')
- Pending users awaiting approval
- Currently active events count
- Total requests submitted today/this week

**FR-11.4** User management page (`/superadmin/users`) must display:
- Table of all users with: username, email, status, created date, last login
- Actions: [Activate], [Deactivate], [View Details], [Delete]

**FR-11.5** Super admin must be able to create new user accounts manually via `/superadmin/users/new`.

**FR-11.6** Manually created accounts can be marked as "free" (no payment required).

**FR-11.7** Super admin must be able to change user status between: `pending`, `active`, `suspended`, `cancelled`.

### 4.12 Existing Data Migration

**FR-12.1** A one-time migration script must archive existing data to backup tables:
- `requests` → `requests_archive`
- `settings` → `settings_archive`
- `admin_auth` → `admin_auth_archive`

**FR-12.2** After migration, production tables must start fresh with multi-tenant schema.

**FR-12.3** Migration must be reversible (rollback plan documented).

---

## 5. Non-Goals (Out of Scope for Phase 1)

**NG-1** Multiple concurrent events per user (database designed to support, but UI/logic deferred to Phase 2)

**NG-2** Advanced analytics dashboard (beyond basic stats)

**NG-3** Email notifications (registration confirmation, event reminders, etc.)

**NG-4** Self-service password reset (manual admin intervention for Phase 1)

**NG-5** User profile customization (avatar uploads, custom themes)

**NG-6** Mobile app (web-only for Phase 1)

**NG-7** API for third-party integrations

**NG-8** Automatic subscription renewal handling (manual monitoring by admin)

**NG-9** Subdomain-based routing (path-based only: `/:username/*`)

**NG-10** Multiple payment providers (Stripe only for Phase 1)

---

## 6. Design Considerations

### 6.1 Database Schema Changes

#### New Tables

**`users` table:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user', -- 'user' or 'superadmin'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'cancelled'
  subscription_type VARCHAR(20), -- 'one-off', 'subscription', 'custom', 'free'
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);
```

**`events` table:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  pin VARCHAR(4) NOT NULL,
  bypass_token VARCHAR(64) NOT NULL,
  display_token VARCHAR(64),
  active BOOLEAN DEFAULT true,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  CONSTRAINT one_active_event_per_user UNIQUE (user_id, active) WHERE active = true
);
```

**`display_tokens` table:**
```sql
CREATE TABLE display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  uses_remaining INT DEFAULT 3,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Modified Existing Tables

**`requests` table:**
```sql
ALTER TABLE requests ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE requests ADD COLUMN event_id UUID REFERENCES events(id);
CREATE INDEX idx_requests_user_id ON requests(user_id);
CREATE INDEX idx_requests_event_id ON requests(event_id);
```

**`settings` table:**
```sql
ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX idx_settings_user_id ON settings(user_id);
```

### 6.2 UI Components

- **PIN Prompt Screen**: Full-screen centered card with large PIN input
- **Event Status Card**: In admin panel, shows PIN, QR code, and event controls
- **User Status Badges**: Color-coded badges (green=active, yellow=pending, red=suspended)
- **Super Admin User Table**: Sortable table with inline actions

### 6.3 URL Examples

```
Homepage:                    /
Login:                      /login
Register:                   /register

User Public Pages:
  Request Form:             /johnsmith
  Display Screen:           /johnsmith/display
  Display (with token):     /johnsmith/display?dt=abc123xyz

User Admin Pages:
  Dashboard:                /johnsmith/admin/overview
  Requests:                 /johnsmith/admin/requests
  Settings:                 /johnsmith/admin/settings
  Queue:                    /johnsmith/admin/queue
  Spotify:                  /johnsmith/admin/spotify

Super Admin Pages:
  Dashboard:                /superadmin/dashboard
  Users:                    /superadmin/users
  Create User:              /superadmin/users/new
  User Details:             /superadmin/users/:userId
```

---

## 7. Technical Considerations

### 7.1 Security

- **JWT Implementation**: Use `jsonwebtoken` library with HS256 algorithm
- **Cookie Security**: Set `httpOnly`, `secure`, `sameSite: 'lax'`
- **Rate Limiting**: Implement on PIN verification endpoint using `express-rate-limit` or similar
- **SQL Injection**: Use parameterized queries exclusively, no string concatenation
- **Password Hashing**: bcrypt with salt rounds = 12
- **Display Token Rotation**: Generate new token each time, invalidate old ones

### 7.2 Performance

- **Database Indexes**: Add indexes on `user_id` columns in all multi-tenant tables
- **Connection Pooling**: Ensure database pool size can handle multiple concurrent users (recommend min 10, max 50)
- **Spotify API Rate Limiting**: Implement per-user rate limiting to prevent one user affecting others
- **Caching**: Consider Redis for session storage if cookie-based sessions cause issues at scale

### 7.3 Dependencies

- **New:** `stripe` - Payment processing
- **New:** `jsonwebtoken` - JWT token generation/verification
- **New:** `bcryptjs` - Password hashing
- **New:** `express-rate-limit` - Rate limiting for security
- **New:** `qrcode` - QR code generation
- **Existing:** Next.js, PostgreSQL, Pusher, Axios

### 7.4 Migration Strategy

1. **Backup current database**
2. **Run migration script** to archive existing data
3. **Apply schema changes** (new tables, add columns, indexes)
4. **Deploy new codebase** with feature flag disabled
5. **Create super admin account** manually
6. **Enable feature flag**
7. **Test with one test user account**
8. **Full rollout**

### 7.5 Pusher Channel Strategy

Current: Single channel `admin-updates`

**New Structure:**
```javascript
// User-specific channels
const adminChannel = `user-${userId}-admin`;
const publicChannel = `user-${userId}-public`;

// Super admin channel
const superAdminChannel = `superadmin-platform`;
```

All Pusher event subscriptions must include `user_id` for isolation.

---

## 8. Success Metrics

### Phase 1 Success Criteria

1. **User Onboarding**: 5+ test users successfully register, pay, and run events
2. **Data Isolation**: Zero cross-contamination bugs (UserA cannot see UserB's data)
3. **Security**: Zero successful unauthorized access attempts during testing
4. **Performance**: Admin panel loads under 2 seconds with 10 concurrent active events
5. **Payment Success Rate**: 95%+ successful Stripe payment completions
6. **PIN Auth Success**: 90%+ of guests successfully authenticate via PIN or QR on first attempt

### Business Metrics (Post-Launch)

1. **User Acquisition**: 20 paying users within 3 months
2. **Churn Rate**: Under 10% monthly churn
3. **Revenue**: £500/month recurring revenue within 6 months
4. **Support Tickets**: Under 5 tickets per user per month
5. **Uptime**: 99.5% uptime

---

## 9. Open Questions

1. **Q1**: What pricing should we set for one-off events vs subscriptions? (e.g., £10 one-off, £20/month subscription)
   - **Owner to decide** and provide pricing details

2. **Q2**: Should users be able to edit their username after registration, or is it permanent?
   - **Recommendation**: Permanent (changing URLs would break QR codes)

3. **Q3**: How should we handle Stripe webhooks for subscription events (payment_succeeded, payment_failed, subscription_cancelled)?
   - **Requires**: Webhook endpoint implementation plan

4. **Q4**: Should the super admin be able to impersonate users (login as them) for support purposes?
   - **Phase 2 consideration**

5. **Q5**: What happens to a user's data if they cancel their subscription?
   - **Options**: 
     - A) Immediate data deletion
     - B) 30-day grace period before deletion
     - C) Archive indefinitely (soft delete)
   - **Owner to decide**

6. **Q6**: Should we show event history (past events) to users, or only current/active event?
   - **Recommendation**: Show history in Phase 2

7. **Q7**: For the "Contact Me" button on homepage, what should the target be?
   - **Options**: Email link, contact form, external website
   - **Owner to provide**: Contact details

8. **Q8**: Should PIN codes be truly random, or avoid easily confused patterns (e.g., 0000, 1234)?
   - **Recommendation**: Avoid obvious patterns for security

9. **Q9**: What should happen if a user tries to start a new event while one is still active?
   - **Recommendation**: Show error: "You already have an active event. End it first or wait for auto-expiry."

10. **Q10**: Should display tokens be revocable from admin panel (e.g., if TV is stolen)?
    - **Recommendation**: Yes, add "Revoke Display Access" button

---

## 10. Implementation Phases

### Phase 1A: Foundation (Week 1-2)
- Database schema changes
- User registration & authentication
- Path-based routing structure
- Basic super admin panel

### Phase 1B: Event System (Week 2-3)
- Event creation/management
- PIN authentication
- QR code generation
- Bypass token validation

### Phase 1C: Display & Security (Week 3-4)
- Display page authentication
- Display token generation
- Error handling for cross-user access
- Rate limiting

### Phase 1D: Spotify Multi-Tenancy (Week 4-5)
- Per-user Spotify connections
- Spotify OAuth per user
- Multi-user Spotify watcher
- Token isolation

### Phase 1E: Payment Integration (Week 5-6)
- Stripe integration
- Checkout flow
- Webhook handling
- Payment status management

### Phase 1F: Testing & Polish (Week 6-7)
- End-to-end testing
- Security audit
- Performance testing
- Bug fixes

**Estimated Total: 6-7 weeks of focused development**

---

## 11. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data leak between users | Critical | Medium | Comprehensive testing, code review, middleware enforcement |
| Spotify rate limits affecting all users | High | Low | Per-user rate limiting, separate watchers |
| Payment integration bugs | High | Medium | Stripe test mode, thorough webhook testing |
| PIN brute force attacks | Medium | Medium | Rate limiting (5 attempts per 15 min) |
| Display token sharing | Low | High | Limit to 3 uses, short expiry |
| Migration data loss | Critical | Low | Full backup, rollback plan, dry-run testing |
| Performance degradation with 50+ users | Medium | Medium | Database indexing, connection pooling, load testing |

---

## 12. Rollback Plan

If critical bugs are discovered post-deployment:

1. **Immediate**: Disable new user registrations
2. **Hour 1**: Revert to previous deployment via Git tag
3. **Hour 2**: Restore database from pre-migration backup
4. **Hour 4**: Root cause analysis, fix in staging
5. **Day 2**: Re-deploy with fixes after testing

**Data Preservation**: All archived data remains intact for rollback.

---

## Appendix A: User Journey Flowcharts

### Guest Request Journey (QR Scan)
```
Guest → Scan QR code → Opens /johnsmith?t=abc123
  → System validates bypass token
  → Token valid → Show request form immediately
  → Guest submits request → Success!
```

### Guest Request Journey (Manual)
```
Guest → Visits /johnsmith
  → No token, no session → Show PIN prompt
  → Guest enters PIN from display screen
  → System validates PIN
  → PIN correct → Store in session cookie → Show request form
  → Guest submits request → Success!
```

### DJ Event Setup Journey
```
DJ → Login → /johnsmith/admin/overview
  → Click "Start New Event"
  → System generates PIN + bypass token
  → Event status changes to "Active"
  → DJ clicks "Generate QR Code"
  → QR code downloads
  → DJ prints/displays QR code at venue
  → DJ opens display page on venue TV
```

### Super Admin User Management Journey
```
Super Admin → Login → /superadmin/users
  → View pending user "JaneDoe"
  → Click "View Details"
  → See: Registered 2 hours ago, payment received via Stripe
  → Click "Activate Account"
  → User status changes to "active"
  → JaneDoe receives notification (Phase 2)
  → JaneDoe can now login and use platform
```

---

**End of PRD**

*This document is a living document and will be updated as requirements evolve or clarifications are made.*

