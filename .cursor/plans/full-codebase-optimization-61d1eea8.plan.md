<!-- 61d1eea8-71ce-4f76-9b85-0525adbe60f4 1a358a12-4110-46f8-9142-97fcbebe7cb4 -->
# Autonomous Testing Suite Implementation

## Phase 1: Test Infrastructure Setup

### 1.1 Install Testing Dependencies

Add required testing packages:

- `@playwright/test` - E2E browser testing
- `@testing-library/react` - Component testing
- `jest` - Test runner for unit/integration tests
- `ts-jest` - TypeScript support for Jest
- `msw` - Mock Service Worker for API mocking
- `@faker-js/faker` - Generate realistic test data

### 1.2 Create Test Database Configuration

Create `test.env` with separate test database:

- Use separate Neon database or local PostgreSQL
- Configure test-specific environment variables
- Set up Pusher with real credentials for real-time testing
- Mock Spotify API credentials

Files to create:

- `test.env` - Test environment variables
- `scripts/setup-test-db.ts` - Initialize test database schema
- `scripts/seed-test-data.ts` - Seed test fixtures

### 1.3 Configure Test Frameworks

Create configuration files:

- `playwright.config.ts` - Playwright E2E configuration (port 3000)
- `jest.config.ts` - Jest unit/integration configuration
- `jest.setup.ts` - Global test setup/teardown

## Phase 2: E2E Test Suite (Priority 1)

### 2.1 Authentication & Session Tests

Test file: `tests/e2e/auth.spec.ts`

**Scenarios**:

- User registration with email verification
- User login with valid credentials
- Login failure with invalid credentials
- Password reset flow
- Token expiry warning (15 min before expiry)
- Token refresh functionality
- Session transfer between devices
- Force logout from another session
- Logout and event cleanup

### 2.2 Admin Panel - Event Management Tests

Test file: `tests/e2e/admin-event.spec.ts`

**Scenarios**:

- Create new event (offline -> standby -> live)
- Event status transitions (all valid paths)
- Invalid state transitions (should fail)
- Event title editing
- PIN generation and display
- Page controls (enable/disable display/requests)
- Event goes offline on logout
- All requests deleted on offline
- Event settings modification

### 2.3 Admin Panel - Spotify Integration Tests

Test file: `tests/e2e/admin-spotify.spec.ts`

**Scenarios** (Spotify API mocked):

- Spotify connection modal on first login
- Connect Spotify account flow
- Disconnect Spotify
- View current playback status
- Play/pause controls
- Device selector and playback transfer
- Queue display
- Track search functionality
- Token expiry and refresh

### 2.4 Admin Panel - Request Management Tests

Test file: `tests/e2e/admin-requests.spec.ts`

**Scenarios**:

- View all requests (pending/approved/rejected/played)
- Approve request
- Approve request with "Play Next"
- Reject request with reason
- Delete request
- Bulk operations
- Request status changes reflected in real-time (Pusher)
- Duplicate request detection
- Auto-mark as played when track plays
- Pagination (50 items per page)
- Search/filter requests

### 2.5 Admin Panel - Statistics & Monitoring

Test file: `tests/e2e/admin-stats.spec.ts`

**Scenarios**:

- Stats display (total, pending, approved, rejected, played)
- Real-time stats updates via Pusher
- Top artists/tracks display
- Request history charts
- Spotify connection status indicator
- Auto-refresh every 30 seconds

### 2.6 Public Request Page Tests

Test file: `tests/e2e/public-request.spec.ts`

**Scenarios**:

- Access request page with valid PIN
- Access denied with invalid PIN
- Page disabled when event offline
- Page disabled when requests disabled
- Search for tracks (Spotify mocked)
- Select track from search results
- Submit request with nickname
- Submit anonymous request
- Duplicate prevention (same track within 30 min)
- Request submission rate limiting
- Confirmation message after submission
- Real-time updates when status changes

### 2.7 Public Display Page Tests

Test file: `tests/e2e/public-display.spec.ts`

**Scenarios**:

- Access display page with valid PIN
- Access denied with invalid PIN
- Page disabled when event offline
- Page disabled when display disabled
- Show current playing track
- Show track progress bar
- Show queue (next 5 tracks)
- Real-time updates via Pusher
- Now playing changes automatically
- Queue updates when approved
- Display screen styling/animations

### 2.8 Real-Time Updates Tests (Pusher)

Test file: `tests/e2e/realtime.spec.ts`

**Scenarios** (uses REAL Pusher):

- Request status change broadcasts
- Stats update broadcasts
- Event state change broadcasts
- Queue update broadcasts
- Now playing update broadcasts
- Multiple clients receive updates
- Reconnection after disconnect
- Rate limiting prevents spam
- Deduplication works correctly

### 2.9 Mobile Responsiveness Tests

Test file: `tests/e2e/mobile.spec.ts`

**Scenarios**:

- Admin panel on mobile (viewport: 375x667)
- Request page on mobile
- Display page on mobile
- Touch interactions
- Mobile navigation
- Cache busting on mobile

### 2.10 Error Handling & Edge Cases Tests

Test file: `tests/e2e/edge-cases.spec.ts`

**Scenarios**:

- Network failures (offline mode)
- API timeouts
- Invalid data submissions
- SQL injection attempts
- XSS prevention
- CSRF protection
- Rate limiting enforcement
- Concurrent user sessions
- Race conditions (multiple admins)
- Database connection failures
- Pusher connection failures
- Graceful degradation

## Phase 3: API Integration Tests

### 3.1 Authentication API Tests

Test file: `tests/api/auth.spec.ts`

**Endpoints**:

- POST `/api/auth/login` - Login flow
- POST `/api/auth/register` - Registration
- POST `/api/auth/logout` - Logout with cleanup
- POST `/api/auth/refresh-session` - Token refresh
- POST `/api/auth/transfer-session` - Session transfer
- POST `/api/auth/forgot-password` - Password reset
- POST `/api/auth/reset-password` - Reset with token
- POST `/api/auth/verify-email` - Email verification

### 3.2 Admin API Tests

Test file: `tests/api/admin.spec.ts`

**Endpoints**:

- GET `/api/admin/stats` - Statistics
- GET `/api/admin/requests` - Request list with pagination
- POST `/api/admin/approve/:id` - Approve request
- POST `/api/admin/reject/:id` - Reject request
- DELETE `/api/admin/delete/:id` - Delete request
- POST `/api/admin/cleanup-requests` - Delete all requests
- GET `/api/admin/playback/pause` - Pause playback
- POST `/api/admin/playback/resume` - Resume playback

### 3.3 Event API Tests

Test file: `tests/api/event.spec.ts`

**Endpoints**:

- GET `/api/event/status` - Get event status
- POST `/api/event/status` - Update event status
- GET `/api/events/current` - Get current event
- PATCH `/api/event/settings` - Update settings
- POST `/api/event/pages` - Toggle pages

### 3.4 Spotify API Tests (Mocked)

Test file: `tests/api/spotify.spec.ts`

**Endpoints**:

- GET `/api/spotify/auth` - Auth URL generation
- GET `/api/spotify/callback` - OAuth callback
- GET `/api/spotify/status` - Connection status
- GET `/api/spotify/devices` - Available devices
- POST `/api/spotify/transfer-playback` - Transfer playback
- GET `/api/spotify/search` - Track search
- POST `/api/spotify/add-to-queue` - Add to queue

### 3.5 Public API Tests

Test file: `tests/api/public.spec.ts`

**Endpoints**:

- POST `/api/request` - Submit song request
- GET `/api/public/event/:pin` - Get event by PIN
- GET `/api/display/status/:pin` - Display status
- GET `/api/display/queue/:pin` - Queue for display

### 3.6 Pusher API Tests

Test file: `tests/api/pusher.spec.ts`

**Endpoints**:

- POST `/api/pusher/auth` - Channel authentication
- Test event triggering functions
- Test channel permissions

## Phase 4: Unit Tests

### 4.1 Database Function Tests

Test file: `tests/unit/db.spec.ts`

**Functions** (`src/lib/db.ts`):

- `getRequestsByStatus()` - Optimized query
- `getRequestsByUserId()` - User-scoped requests
- `checkRecentDuplicate()` - Duplicate detection
- `getRequestsCount()` - Counts by status
- `getAllRequests()` - Paginated requests
- Connection pool management

### 4.2 Spotify Service Tests (Mocked)

Test file: `tests/unit/spotify.spec.ts`

**Functions** (`src/lib/spotify.ts`):

- `isConnectedAndValid()` - Connection check
- `getCurrentPlayback()` - Get playback state
- `getQueue()` - Get queue
- `pause()` - Pause playback
- `resume()` - Resume playback
- `getAvailableDevices()` - Device list
- `transferPlayback()` - Device transfer
- `searchTracks()` - Track search
- Token refresh logic

### 4.3 Pusher Service Tests

Test file: `tests/unit/pusher.spec.ts`

**Functions** (`src/lib/pusher.ts`):

- `triggerEvent()` - Event triggering
- `triggerStatsUpdate()` - Stats broadcast
- `triggerStateUpdate()` - State broadcast
- `triggerRequestsCleanup()` - Cleanup broadcast
- `triggerForceLogout()` - Force logout
- Rate limiting
- Deduplication

### 4.4 Authentication Tests

Test file: `tests/unit/auth.spec.ts`

**Functions** (`src/lib/auth.ts`):

- `generateToken()` - JWT generation
- `verifyToken()` - JWT verification
- `hashPassword()` - Password hashing
- `comparePassword()` - Password comparison
- `getCookieOptions()` - Cookie configuration
- Token expiry logic

### 4.5 Event Service Tests

Test file: `tests/unit/event-service.spec.ts`

**Functions** (`src/lib/event-service.ts`):

- Event lifecycle management
- State transitions
- Validation logic

## Phase 5: Test Execution & Reporting

### 5.1 Create Test Runner Script

File: `scripts/run-tests.ts`

**Features**:

- Automatic test database creation
- Database schema initialization
- Test data seeding
- Dev server startup (port 3000)
- Run E2E tests first, then API, then unit
- Server shutdown and cleanup
- Database teardown
- Generate comprehensive report

### 5.2 Create Test Report Generator

File: `scripts/generate-test-report.ts`

**Report includes**:

- Executive summary (total tests, passed, failed, skipped)
- Coverage statistics
- Test duration by category
- Failed test details with screenshots
- API endpoint coverage matrix
- Database query performance metrics
- Pusher event verification
- HTML report with charts
- JSON export for CI/CD

### 5.3 Mock Service Worker Setup

File: `tests/mocks/spotify-handlers.ts`

**Mocked Spotify endpoints**:

- `/api/token` - OAuth token
- `/me/player` - Current playback
- `/me/player/devices` - Devices
- `/me/player/queue` - Queue
- `/search` - Track search
- All player control endpoints

### 5.4 Test Fixtures & Utilities

Files to create:

- `tests/fixtures/users.ts` - Test user data
- `tests/fixtures/events.ts` - Test event data
- `tests/fixtures/requests.ts` - Test request data
- `tests/fixtures/spotify-responses.ts` - Mocked Spotify data
- `tests/utils/db-helpers.ts` - Database test utilities
- `tests/utils/auth-helpers.ts` - Auth test utilities
- `tests/utils/wait-for.ts` - Async test helpers

## Phase 6: Execute Full Test Suite

### 6.1 Run Complete Test Suite

Execute command:

```bash
npm run test:full
```

This will:

1. Set up test database
2. Seed test data
3. Start dev server on port 3000
4. Run all E2E tests (priority 1)
5. Run all API integration tests
6. Run all unit tests
7. Generate HTML/JSON reports
8. Clean up (stop server, drop test DB)
9. Display summary in console

### 6.2 Generate Final Report

File: `TEST-REPORT.md`

**Contents**:

- Test execution summary
- All test results by category
- Coverage metrics
- Performance benchmarks
- Failed tests with details
- Screenshots of failures
- Recommendations
- Risk assessment

## Expected Test Coverage

### Test Count Estimate:

- E2E Tests: ~120 test cases
- API Tests: ~60 test cases
- Unit Tests: ~40 test cases
- **Total: ~220+ test cases**

### Coverage Goals:

- Code coverage: >80%
- API endpoint coverage: 100%
- User flow coverage: 100%
- Edge case coverage: >90%

## Configuration Files

### Key files to create/modify:

1. `package.json` - Add test scripts
2. `playwright.config.ts` - E2E configuration
3. `jest.config.ts` - Unit/API configuration
4. `test.env` - Test environment variables
5. `.env.test.local` - Local test overrides
6. `tsconfig.test.json` - Test TypeScript config

## Success Criteria

The test suite passes if:

- ✅ All authentication flows work correctly
- ✅ Admin panel functions operate as expected
- ✅ Real-time updates via Pusher work reliably
- ✅ Request lifecycle (submit → approve → play) functions
- ✅ Event lifecycle transitions correctly
- ✅ Database queries are optimized and accurate
- ✅ API endpoints return correct responses
- ✅ Error handling works for all edge cases
- ✅ Mobile responsiveness verified
- ✅ Security measures (auth, CSRF, XSS) validated
- ✅ No race conditions or data corruption
- ✅ All tests can run autonomously without manual input

## Execution Timeline

Estimated execution time:

- Setup: ~2-3 minutes
- E2E tests: ~15-20 minutes
- API tests: ~5-7 minutes
- Unit tests: ~2-3 minutes
- Report generation: ~1 minute
- **Total: ~25-35 minutes**

### To-dos

- [ ] Install testing dependencies (Playwright, Jest, MSW, faker)
- [ ] Create test database configuration and initialization scripts
- [ ] Configure Playwright, Jest, and test environment files
- [ ] Create test data fixtures and utilities
- [ ] Set up MSW handlers to mock Spotify API endpoints
- [ ] Write E2E authentication and session management tests
- [ ] Write E2E admin event management tests
- [ ] Write E2E admin Spotify integration tests
- [ ] Write E2E admin request management tests
- [ ] Write E2E public request and display page tests
- [ ] Write E2E real-time Pusher update tests (using real Pusher)
- [ ] Write E2E error handling and edge case tests
- [ ] Write API integration tests for all endpoints
- [ ] Write unit tests for database, services, and utilities
- [ ] Create automated test runner with server startup/shutdown
- [ ] Create comprehensive test report generator
- [ ] Execute complete autonomous test suite
- [ ] Generate and present final test execution report