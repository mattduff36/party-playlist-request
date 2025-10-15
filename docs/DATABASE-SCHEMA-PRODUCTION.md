# Production Database Schema Documentation
**Last Updated**: October 15, 2025  
**Database**: PostgreSQL (Neon)  
**Schema Version**: 1.0 (Original 7-table schema)

---

## Overview

The production database currently uses the **original 7-table schema** with individual columns for track data. This differs from the planned 4-table JSONB schema.

---

## Table Schemas

### 1. `users` Table
Stores user accounts (DJs/admins).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active_session_id TEXT,
  active_session_created_at TIMESTAMP WITH TIME ZONE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_token_expires TIMESTAMP WITH TIME ZONE,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMP WITH TIME ZONE
);
```

**Key Columns**:
- `id` - Primary key (UUID)
- `username` - Unique username (lowercase)
- `email` - Unique email address
- `password` - Bcrypt hashed password
- `role` - User role ('user', 'admin', 'superadmin')
- `active_session_id` - Current login session ID (for single-session enforcement)
- `active_session_created_at` - When current session was created
- Email verification and password reset tokens

---

### 2. `events` Table
Stores event configurations for each user.

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_admin_id UUID REFERENCES admins(id),
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  device_id TEXT
);
```

**Key Columns**:
- `id` - Primary key (UUID)
- `user_id` - FK to users table
- `pin` - 4-digit PIN for guest access (unique, auto-generated, avoids common patterns)
- `status` - Event status ('offline', 'standby', 'live')
- `config` - JSONB configuration (event settings, page toggles, bypass token, etc.)
- `device_id` - Spotify device ID for playback
- `version` - Optimistic locking version

**Config JSONB Structure**:
```json
{
  "event_title": "Party Playlist!",
  "welcome_message": "Welcome to the Party!",
  "auto_decline_explicit": true,
  "auto_approve_requests": false,
  "max_requests_per_user": 10,
  "pages_enabled": {
    "requests": true,
    "display": true
  },
  "bypass_token": "bp_xxxxx..."
}
```

---

### 3. `requests` Table
Stores song requests (original 7-column schema).

```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_uri TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_name TEXT NOT NULL,
  requester_nickname TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  played_at TIMESTAMP WITH TIME ZONE,
  spotify_added_to_queue BOOLEAN DEFAULT FALSE,
  spotify_added_to_playlist BOOLEAN DEFAULT FALSE
);
```

**Key Columns**:
- `id` - Primary key (UUID)
- `track_uri` - Spotify track URI
- `track_name` - Song title
- `artist_name` - Artist(s) name
- `album_name` - Album title
- `requester_nickname` - Guest's display name
- `status` - Request status ('pending', 'approved', 'rejected', 'played')
- `played_at` - Timestamp when marked as played
- `spotify_added_to_queue` - Tracking flag
- `spotify_added_to_playlist` - Tracking flag

**❌ Missing Columns** (compared to planned schema):
- `user_id` - FK to users (for multi-tenant isolation)
- `event_id` - FK to events (for event-request relationships)
- `duration_ms` - Track duration
- `requester_ip_hash` - For rate limiting
- `user_session_id` - For user-specific notifications

**Workaround**: Application handles missing columns gracefully.

---

### 4. `spotify_auth` Table
Stores Spotify OAuth tokens.

```sql
CREATE TABLE spotify_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Columns**:
- `user_id` - FK to users (unique - one Spotify account per user)
- `access_token` - Spotify access token (refreshed automatically)
- `refresh_token` - Spotify refresh token
- `expires_at` - Token expiry timestamp
- `scope` - OAuth scopes granted

---

### 5. `admins` Table
Stores admin user information (legacy table).

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Note**: This table may be deprecated in favor of `users.role`.

---

### 6. `session_store` Table
Stores active sessions (if using session-based auth).

```sql
CREATE TABLE session_store (
  sid TEXT PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP WITH TIME ZONE NOT NULL
);
```

---

### 7. `drizzle` Table
Drizzle ORM migration tracking.

```sql
CREATE TABLE drizzle (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
```

---

## Indexes

**Existing Indexes**:
- `users.username` - Unique index
- `users.email` - Unique index
- `events.pin` - Unique index
- `events.user_id` - FK index
- `requests.status` - For filtering
- `requests.track_uri` - For duplicate detection
- `requests.created_at` - For ordering

**Recommended Additional Indexes** (not yet created):
```sql
CREATE INDEX idx_requests_status_created ON requests(status, created_at);
CREATE INDEX idx_spotify_auth_user_id ON spotify_auth(user_id);
CREATE INDEX idx_events_user_status ON events(user_id, status);
```

---

## Relationships

```
users (1) ─── (1) spotify_auth
  │
  ├─ (1:n) ─── events
  │
  └─ (1:n) ─── admins

events ─── (no FK) ─── requests (⚠️ Missing relationship)
```

**⚠️ Missing Relationships**:
- `requests.user_id` → `users.id`
- `requests.event_id` → `events.id`

---

## Multi-Tenancy Status

**Current**: Partial multi-tenancy
- ✅ Users table supports multiple users
- ✅ Events table has `user_id` FK
- ✅ Spotify auth is user-specific
- ❌ Requests table has no `user_id` or `event_id`

**Impact**: Requests are currently global, not isolated per user/event.

**Workaround**: Application filters requests by username in queries.

---

## Data Types

| Column Type | SQL Type | Notes |
|-------------|----------|-------|
| IDs | UUID | Primary keys, generated |
| Timestamps | TIMESTAMP WITH TIME ZONE | Always with timezone |
| Text | TEXT | Variable length strings |
| Config | JSONB | JSON with indexing support |
| Booleans | BOOLEAN | True/false flags |
| Integers | INTEGER | Version counters |

---

## Constraints

**Primary Keys**: All tables have UUID primary keys

**Foreign Keys**:
- `events.user_id` → `users.id` (CASCADE DELETE)
- `spotify_auth.user_id` → `users.id` (CASCADE DELETE)
- `admins.user_id` → `users.id` (CASCADE DELETE)

**Unique Constraints**:
- `users.username`
- `users.email`
- `events.pin`
- `spotify_auth.user_id`
- `admins.user_id`

**NOT NULL Constraints**:
- All primary keys
- User credentials (username, email, password)
- Event core fields (user_id, pin, status, config)
- Request track data (uri, name, artist, album)

---

## Migration Path (Planned)

### Phase 1: Add Missing Columns
```sql
ALTER TABLE requests ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE requests ADD COLUMN event_id UUID REFERENCES events(id);
ALTER TABLE requests ADD COLUMN duration_ms INTEGER;
ALTER TABLE requests ADD COLUMN requester_ip_hash TEXT;
ALTER TABLE requests ADD COLUMN user_session_id TEXT;
```

### Phase 2: Backfill Data
- Set `user_id` based on application context
- Set `event_id` based on current active event
- Calculate `duration_ms` from Spotify API if available

### Phase 3: Add Constraints
```sql
ALTER TABLE requests ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE requests ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX idx_requests_user_event ON requests(user_id, event_id);
```

### Phase 4: Consider JSONB Migration
- Consolidate track columns into `track_data JSONB`
- Better scalability for future track metadata

---

## Environment Variables

**Required**:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/database
```

**Connection Pooling**:
- Pool size: 10 (configurable)
- Idle timeout: 30s
- Connection timeout: 20s

---

## Backup & Maintenance

**Backup Strategy** (Recommended):
- Daily automated backups
- Point-in-time recovery enabled
- Retention: 30 days

**Maintenance** (Recommended):
- Weekly VACUUM ANALYZE
- Monthly REINDEX
- Quarterly schema review

---

## Known Issues & Workarounds

### Issue 1: Missing Request Relationships
**Problem**: No `user_id` or `event_id` in requests table  
**Impact**: Cannot isolate requests per user/event at database level  
**Workaround**: Application-level filtering by username

### Issue 2: No Request Duration
**Problem**: Missing `duration_ms` column  
**Impact**: Cannot display track duration on guest request page  
**Workaround**: Show "--:--" for duration

### Issue 3: No Rate Limiting Support
**Problem**: Missing `requester_ip_hash` column  
**Impact**: Cannot prevent spam at database level  
**Workaround**: Basic duplicate checking in application code

---

## Performance Considerations

**Query Patterns**:
1. Event lookup by user_id (frequent) - ✅ Indexed
2. Request filtering by status (frequent) - ✅ Indexed
3. Spotify auth lookup by user_id (frequent) - ⚠️ Needs index
4. Request lookup by track_uri (occasional) - ✅ Indexed

**Optimization Recommendations**:
1. Add composite indexes for common query patterns
2. Implement connection pooling (already done)
3. Add caching layer for frequent reads
4. Consider read replicas for display screens

---

## Security Considerations

**Sensitive Data**:
- User passwords - ✅ Bcrypt hashed
- Spotify tokens - ✅ Stored encrypted
- Session tokens - ✅ Secure cookies
- PINs - ⚠️ Stored in plaintext (considered acceptable for 4-digit codes)

**Access Control**:
- Row-level security: ❌ Not implemented
- Application-level: ✅ JWT-based auth
- Multi-tenancy: ⚠️ Partial (missing request isolation)

---

## Comparison: Current vs. Planned Schema

| Feature | Current (7-Table) | Planned (4-Table JSONB) |
|---------|-------------------|-------------------------|
| Track Storage | Individual columns | JSONB `track_data` |
| Multi-tenancy | Partial | Full |
| Request Relationships | Missing FKs | Complete FKs |
| Extensibility | Limited | High (JSONB) |
| Query Performance | Good | Better (with indexes) |
| Schema Complexity | Lower | Higher |

---

## Tools & Utilities

**Schema Inspection**:
```bash
node scripts/check-events-schema.js
node scripts/list-users.js
```

**Migrations**:
```bash
npm run db:migrate
npm run db:push
```

**Studio**:
```bash
npm run db:studio  # Drizzle Studio
```

---

## Status Summary

✅ **Production-Ready**: Current schema works for single-tenant scenarios  
⚠️ **Needs Improvement**: Multi-tenancy requires additional columns  
📋 **Planned**: Migration to 4-table JSONB schema (future release)

---

**Last Reviewed**: October 15, 2025  
**Next Review**: Before production launch / After adding multi-tenancy

