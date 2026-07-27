# Database Migration Design: 7-Table to 4-Table Schema

## Current 7-Table Schema Analysis

### 1. **requests** table
- **Purpose**: Song requests from users
- **Key fields**: id, track_uri, track_name, artist_name, album_name, duration_ms, requester_ip_hash, requester_nickname, user_session_id, status, created_at, approved_at, approved_by, rejection_reason, spotify_added_to_queue, spotify_added_to_playlist

### 2. **settings** table  
- **Purpose**: Global application settings (key-value store)
- **Key fields**: key, value, updated_at
- **Data**: party_playlist_id, target_device_id, party_name, max_requests_per_ip_per_hour, request_cooldown_seconds

### 3. **admins** table
- **Purpose**: Admin user accounts
- **Key fields**: id, username, password_hash, created_at, last_login, is_active

### 4. **spotify_auth** table
- **Purpose**: Spotify authentication tokens (singleton)
- **Key fields**: id (always 1), access_token, refresh_token, expires_at, scope, token_type, updated_at

### 5. **event_settings** table
- **Purpose**: Event configuration (singleton)
- **Key fields**: id (always 1), event_title, dj_name, venue_info, welcome_message, secondary_message, tertiary_message, show_qr_code, display_refresh_interval, admin_polling_interval, display_polling_interval, now_playing_polling_interval, sse_update_interval, request_limit, auto_approve, force_polling, requests_page_enabled, display_page_enabled, message_text, message_duration, message_created_at, updated_at

### 6. **oauth_sessions** table
- **Purpose**: OAuth state management (temporary)
- **Key fields**: state, code_verifier, created_at, expires_at

### 7. **notifications** table
- **Purpose**: User notifications
- **Key fields**: id, type, message, requester_name, track_name, created_at, shown

## New 4-Table Schema Design

### 1. **events** table
- **Purpose**: Core event state management
- **Key fields**: id, status (offline/standby/live), version, active_admin_id, device_id, config (JSONB), updated_at
- **Consolidates**: event_settings + settings + global state

### 2. **admins** table  
- **Purpose**: Admin user management
- **Key fields**: id, email, password_hash, name, created_at
- **Changes**: username → email, removed last_login/is_active

### 3. **spotify_tokens** table
- **Purpose**: Spotify integration per admin
- **Key fields**: admin_id (FK), access_token, refresh_token, expires_at, scope, updated_at
- **Changes**: One-to-one with admins instead of singleton

### 4. **requests** table
- **Purpose**: Song requests with full track data
- **Key fields**: id, event_id (FK), track_id, track_data (JSONB), submitted_by, status, idempotency_key, created_at, approved_at, rejected_at, played_at
- **Changes**: Consolidated track data into JSONB, added event relationship

## Migration Strategy

### Phase 1: Data Preservation
1. **Backup existing data** before any changes
2. **Create new tables** alongside existing ones
3. **Migrate data** with proper transformations
4. **Validate data integrity** before switching

### Phase 2: Data Transformation

#### **events table creation**:
```sql
-- Create events table
INSERT INTO events (id, status, version, config, updated_at)
SELECT 
  gen_random_uuid(),
  CASE 
    WHEN es.requests_page_enabled = true AND es.display_page_enabled = true THEN 'live'
    WHEN es.requests_page_enabled = false AND es.display_page_enabled = false THEN 'offline'
    ELSE 'standby'
  END as status,
  0 as version,
  jsonb_build_object(
    'pages_enabled', jsonb_build_object(
      'requests', COALESCE(es.requests_page_enabled, false),
      'display', COALESCE(es.display_page_enabled, false)
    ),
    'event_title', COALESCE(es.event_title, 'Party DJ Requests'),
    'dj_name', COALESCE(es.dj_name, ''),
    'venue_info', COALESCE(es.venue_info, ''),
    'welcome_message', COALESCE(es.welcome_message, 'Request your favorite songs!'),
    'secondary_message', COALESCE(es.secondary_message, 'Your requests will be reviewed by the DJ'),
    'tertiary_message', COALESCE(es.tertiary_message, 'Keep the party going!'),
    'show_qr_code', COALESCE(es.show_qr_code, true),
    'request_limit', COALESCE(es.request_limit, 10),
    'auto_approve', COALESCE(es.auto_approve, false),
    'message_text', es.message_text,
    'message_duration', es.message_duration,
    'message_created_at', es.message_created_at
  ) as config,
  COALESCE(es.updated_at, CURRENT_TIMESTAMP) as updated_at
FROM event_settings es
WHERE es.id = 1;
```

#### **admins table migration**:
```sql
-- Migrate admins (username → email)
INSERT INTO admins (id, email, password_hash, name, created_at)
SELECT 
  id,
  username as email,  -- Assuming username is email
  password_hash,
  username as name,   -- Use username as name initially
  created_at
FROM admins_old;
```

#### **spotify_tokens table creation**:
```sql
-- Create spotify_tokens (one-to-one with first admin)
INSERT INTO spotify_tokens (admin_id, access_token, refresh_token, expires_at, scope, updated_at)
SELECT 
  (SELECT id FROM admins LIMIT 1) as admin_id,
  access_token,
  refresh_token,
  expires_at,
  scope,
  updated_at
FROM spotify_auth
WHERE id = 1;
```

#### **requests table migration**:
```sql
-- Migrate requests with event relationship
INSERT INTO requests (id, event_id, track_id, track_data, submitted_by, status, idempotency_key, created_at, approved_at, rejected_at, played_at)
SELECT 
  r.id,
  (SELECT id FROM events LIMIT 1) as event_id,  -- Link to single event
  r.track_uri as track_id,
  jsonb_build_object(
    'id', r.track_uri,
    'uri', r.track_uri,
    'name', r.track_name,
    'artists', jsonb_build_array(
      jsonb_build_object('name', r.artist_name, 'id', '')
    ),
    'album', jsonb_build_object(
      'name', COALESCE(r.album_name, ''),
      'id', '',
      'images', jsonb_build_array()
    ),
    'duration_ms', r.duration_ms,
    'explicit', false,
    'external_urls', jsonb_build_object('spotify', '')
  ) as track_data,
  COALESCE(r.requester_nickname, 'Anonymous') as submitted_by,
  CASE 
    WHEN r.status = 'queued' THEN 'approved'
    WHEN r.status = 'failed' THEN 'rejected'
    ELSE r.status
  END as status,
  r.requester_ip_hash as idempotency_key,
  r.created_at,
  r.approved_at,
  CASE WHEN r.status = 'rejected' THEN r.created_at ELSE NULL END as rejected_at,
  CASE WHEN r.status = 'played' THEN r.approved_at ELSE NULL END as played_at
FROM requests_old r;
```

### Phase 3: Data Cleanup
1. **Drop old tables** after validation
2. **Update application code** to use new schema
3. **Test thoroughly** before production deployment

## Data Loss Considerations

### **Will be lost**:
- **oauth_sessions**: Temporary data, safe to lose
- **notifications**: Can be regenerated from request data
- **settings table**: Merged into events.config
- **Multiple admin support**: Only first admin's Spotify tokens preserved

### **Will be preserved**:
- **All request data** with enhanced structure
- **All event settings** in JSONB format
- **Admin accounts** (with email instead of username)
- **Spotify authentication** (linked to first admin)

## Rollback Strategy

1. **Keep old tables** during migration period
2. **Create rollback scripts** to restore from old tables
3. **Test rollback procedure** before production
4. **Monitor application** for 24-48 hours after migration

## Performance Considerations

### **Indexes to create**:
```sql
-- Events table
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_updated_at ON events(updated_at);

-- Requests table  
CREATE INDEX idx_requests_event_id ON requests(event_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at);
CREATE INDEX idx_requests_event_status ON requests(event_id, status);

-- Spotify tokens
CREATE INDEX idx_spotify_tokens_admin_id ON spotify_tokens(admin_id);
```

### **Query optimization**:
- Use JSONB operators for config queries
- Leverage foreign key relationships
- Consider partitioning for large request tables
