# 🧪 Party Playlist Request - Test Suite Documentation

## Overview

This is a comprehensive autonomous testing suite that validates all functionality of the Party Playlist Request application. The suite includes:

- **120+ E2E Tests** - Complete user flows and UI interactions
- **60+ API Tests** - All backend endpoints and business logic
- **40+ Unit Tests** - Core functions and utilities
- **Total: 220+ Test Cases**

## Quick Start

### Run Full Test Suite (Autonomous)

```bash
npm run test:full
```

This command will:
1. ✅ Setup test database
2. ✅ Seed test data
3. ✅ Start dev server (port 3000)
4. ✅ Run all E2E tests
5. ✅ Run all API tests
6. ✅ Run all unit tests
7. ✅ Generate comprehensive report
8. ✅ Clean up automatically

**Duration**: ~25-35 minutes

### Run Individual Test Types

```bash
# E2E tests only
npm run test:e2e

# E2E tests with UI (interactive)
npm run test:e2e:ui

# API tests only
npm run test:api

# Unit tests only
npm run test:unit:new
```

### Setup Test Database

```bash
# Initialize test database
npm run test:setup-db

# Seed test data
npm run test:seed-db
```

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests (Playwright)
│   ├── auth.spec.ts       # Authentication & sessions
│   ├── admin-event.spec.ts # Event management
│   ├── admin-spotify.spec.ts # Spotify integration
│   ├── admin-requests.spec.ts # Request management
│   ├── admin-stats.spec.ts # Statistics
│   ├── public-request.spec.ts # Public request page
│   ├── public-display.spec.ts # Public display page
│   ├── realtime.spec.ts   # Pusher real-time updates
│   ├── mobile.spec.ts     # Mobile responsiveness
│   └── edge-cases.spec.ts # Error handling
│
├── api/                    # API integration tests (Jest)
│   ├── auth.spec.ts       # Auth endpoints
│   ├── admin.spec.ts      # Admin endpoints
│   ├── event.spec.ts      # Event endpoints
│   ├── spotify.spec.ts    # Spotify endpoints (mocked)
│   ├── public.spec.ts     # Public endpoints
│   └── pusher.spec.ts     # Pusher endpoints
│
├── unit/                   # Unit tests (Jest)
│   ├── db.spec.ts         # Database functions
│   ├── spotify.spec.ts    # Spotify service
│   ├── pusher.spec.ts     # Pusher service
│   ├── auth.spec.ts       # Auth functions
│   └── event-service.spec.ts # Event service
│
├── fixtures/               # Test data
│   ├── users.ts           # Test users
│   ├── events.ts          # Test events
│   ├── requests.ts        # Test requests
│   └── spotify-responses.ts # Mocked Spotify data
│
├── mocks/                  # Mock service handlers
│   └── spotify-handlers.ts # MSW Spotify API mocks
│
└── utils/                  # Test utilities
    ├── db-helpers.ts      # Database test helpers
    ├── auth-helpers.ts    # Auth test helpers
    └── wait-for.ts        # Async test helpers
```

## Test Fixtures

### Test Users

```typescript
// Available test users
TEST_USERS.testuser     // username: testuser, password: password123
TEST_USERS.testadmin    // username: testadmin, password: password123
TEST_USERS.testdj       // username: testdj, password: password123
```

### Test Events

```typescript
// Available test events
TEST_EVENTS.offline     // PIN: 123456, status: offline
TEST_EVENTS.standby     // PIN: 789012, status: standby
TEST_EVENTS.live        // PIN: 345678, status: live
```

## Test Coverage

### E2E Tests (Playwright)

**Authentication** (9 tests):
- ✅ Login with valid credentials
- ✅ Login failure with invalid credentials
- ✅ Spotify connection modal
- ✅ Logout and event cleanup
- ✅ Token expiry warning
- ✅ Token refresh
- ✅ Session transfer
- ✅ Force logout
- ✅ Session persistence

**Admin Event Management** (10 tests):
- ✅ Event state transitions (offline → standby → live)
- ✅ Invalid state transitions
- ✅ Event title editing
- ✅ PIN display
- ✅ Page controls (enable/disable)
- ✅ Event offline on logout
- ✅ Settings modification

**Admin Spotify Integration** (9 tests):
- ✅ Connection flow
- ✅ Playback status display
- ✅ Play/pause controls
- ✅ Device selector
- ✅ Queue display
- ✅ Track search
- ✅ Token refresh

**Admin Request Management** (11 tests):
- ✅ View requests by status
- ✅ Approve request
- ✅ Approve with "Play Next"
- ✅ Reject request
- ✅ Delete request
- ✅ Real-time updates
- ✅ Duplicate detection
- ✅ Auto-mark as played
- ✅ Pagination

**Public Pages** (15 tests):
- ✅ Access with PIN
- ✅ Access denied without PIN
- ✅ Page disabled states
- ✅ Track search and submission
- ✅ Rate limiting
- ✅ Real-time updates

**Real-Time (Pusher)** (9 tests):
- ✅ Request status broadcasts
- ✅ Stats updates
- ✅ State changes
- ✅ Queue updates
- ✅ Multiple clients
- ✅ Reconnection
- ✅ Rate limiting

**Mobile & Edge Cases** (20+ tests):
- ✅ Mobile responsiveness
- ✅ Network failures
- ✅ API timeouts
- ✅ Invalid inputs
- ✅ Security (SQL injection, XSS, CSRF)
- ✅ Concurrent sessions
- ✅ Race conditions
- ✅ Graceful degradation

### API Tests (Jest)

**Authentication API** (8 endpoints):
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/logout
- POST /api/auth/refresh-session
- POST /api/auth/transfer-session
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/verify-email

**Admin API** (8 endpoints):
- GET /api/admin/stats
- GET /api/admin/requests
- POST /api/admin/approve/:id
- POST /api/admin/reject/:id
- DELETE /api/admin/delete/:id
- POST /api/admin/cleanup-requests
- GET /api/admin/playback/pause
- POST /api/admin/playback/resume

**Event API** (5 endpoints):
- GET /api/event/status
- POST /api/event/status
- GET /api/events/current
- PATCH /api/event/settings
- POST /api/event/pages

**Spotify API** (7 endpoints - mocked):
- GET /api/spotify/auth
- GET /api/spotify/callback
- GET /api/spotify/status
- GET /api/spotify/devices
- POST /api/spotify/transfer-playback
- GET /api/spotify/search
- POST /api/spotify/add-to-queue

**Public API** (4 endpoints):
- POST /api/request
- GET /api/public/event/:pin
- GET /api/display/status/:pin
- GET /api/display/queue/:pin

### Unit Tests (Jest)

**Database Functions**:
- getRequestsByStatus()
- getRequestsByUserId()
- checkRecentDuplicate()
- getRequestsCount()
- Connection pool management

**Services**:
- Spotify service methods
- Pusher event triggering
- Auth token generation/verification
- Event lifecycle management

## Test Configuration

### Environment Variables

Test environment variables are configured in `test.env`:

```env
DATABASE_URL=postgresql://...  # Test database (separate from production!)
JWT_SECRET=test_jwt_secret
SPOTIFY_CLIENT_ID=test_id      # Mocked
PUSHER_KEY=real_key            # Real Pusher for testing
```

### Playwright Configuration

```typescript
// playwright.config.ts
- Browsers: Chromium, Firefox, WebKit
- Mobile: Pixel 5, iPhone 12
- Timeout: 60s per test
- Retries: 1 (2 in CI)
- Screenshots: On failure
- Videos: On failure
```

### Jest Configuration

```typescript
// jest.api.config.ts & jest.unit.config.ts
- Environment: Node.js
- Timeout: 30s (API), 15s (unit)
- Coverage: >80% target
- Reporters: JSON, HTML, Console
```

## Test Reports

After running tests, reports are generated in:

```
test-results/
├── playwright-html/index.html    # E2E test report
├── coverage-api/index.html       # API test coverage
├── coverage-unit/index.html      # Unit test coverage
├── playwright-results.json       # E2E results (JSON)
├── jest-results.json            # Jest results (JSON)
└── TEST-REPORT.md               # Comprehensive summary
```

## Success Criteria

All tests pass if:

- ✅ All authentication flows work
- ✅ Admin panel functions correctly
- ✅ Real-time updates work via Pusher
- ✅ Request lifecycle completes properly
- ✅ Event transitions are valid
- ✅ Database queries are optimized
- ✅ API endpoints return correct responses
- ✅ Error handling works for edge cases
- ✅ Mobile responsiveness verified
- ✅ Security measures validated
- ✅ No race conditions
- ✅ All tests run autonomously

## Troubleshooting

### Database Connection Errors

```bash
# Reset test database
npm run test:setup-db
npm run test:seed-db
```

### Port 3000 Already in Use

```bash
# Kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3000 | xargs kill -9
```

### Playwright Browser Not Installed

```bash
npx playwright install
```

### Tests Timing Out

- Increase timeout in `playwright.config.ts`
- Check server logs for errors
- Verify database connection

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:full
      - uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: test-results/
```

## Best Practices

### Writing New Tests

1. **Use fixtures**: Import from `tests/fixtures/`
2. **Use utilities**: Import helpers from `tests/utils/`
3. **Mock externals**: Use MSW for external APIs
4. **Clean up**: Reset state after tests
5. **Assertions**: Use meaningful error messages
6. **Timeouts**: Set appropriate waits

### Test Organization

1. **Group related tests**: Use `describe` blocks
2. **Descriptive names**: Make test names clear
3. **Independent tests**: Each test should be standalone
4. **Setup/teardown**: Use `beforeEach`/`afterEach`
5. **Skip wisely**: Use `test.skip()` for WIP tests

## Support

For issues or questions:
- Review test logs in `test-results/`
- Check `TEST-REPORT.md` for summary
- Review Playwright traces on failure
- Verify environment variables in `test.env`

---

*Test suite created: January 2025*  
*Coverage: 220+ tests*  
*Automation: 100% autonomous*  
*Duration: ~25-35 minutes*


