# API Reference

Complete reference for all API endpoints in the Party Playlist system.

---

## Authentication

All admin endpoints require JWT authentication via cookies or Authorization header.

**Auth Header:**
```
Authorization: Bearer <jwt_token>
```

**Auth Cookie:**
```
auth_token=<jwt_token>
```

---

## Public Endpoints

### GET `/api/search`
Search for Spotify tracks.

**Query Parameters:**
- `q` (string, required): Search query
- `username` (string, required): Username for multi-tenant support
- `limit` (number, optional): Max results (default: 20, max: 50)

**Response:**
```json
{
  "tracks": [...],
  "query": "search query",
  "total": 20
}
```

### POST `/api/request`
Submit a song request.

**Body:**
```json
{
  "track_uri": "spotify:track:...",
  "track_name": "Song Title",
  "artist_name": "Artist Name",
  "album_name": "Album Name",
  "requester_nickname": "John Smith",
  "user_session_id": "session_xxx",
  "username": "djname",
  "pin": "1234" // Optional if bypass token used
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request submitted",
  "request": { ... }
}
```

---

## Authentication Endpoints

### POST `/api/auth/login`
User login.

**Body:**
```json
{
  "username": "djname",
  "password": "password"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "djname",
    "email": "dj@example.com",
    "role": "user"
  },
  "token": "jwt_token"
}
```

### POST `/api/auth/register`
User registration.

**Body:**
```json
{
  "username": "djname",
  "email": "dj@example.com",
  "password": "password"
}
```

### POST `/api/auth/logout`
Logout current user.

### GET `/api/auth/me`
Get current authenticated user.

---

## Admin Endpoints

### GET `/api/admin/requests`
Get all requests for current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "track_name": "Song",
    "artist_name": "Artist",
    "status": "pending|approved|rejected|played",
    "requester_nickname": "John",
    "created_at": "2025-10-17T12:00:00Z"
  }
]
```

### POST `/api/admin/approve/[id]`
Approve a request.

**Response:**
```json
{
  "success": true,
  "request": { ... }
}
```

### POST `/api/admin/reject/[id]`
Reject a request.

**Body:**
```json
{
  "rejection_reason": "Duplicate song"
}
```

### DELETE `/api/admin/delete/[id]`
Delete a request.

### POST `/api/admin/play-again/[id]`
Mark played song for replay.

### GET `/api/admin/queue/details`
Get current Spotify queue and playback state.

**Response:**
```json
{
  "current_track": {
    "name": "Song",
    "artists": ["Artist"],
    "duration_ms": 180000,
    "progress_ms": 60000
  },
  "queue": [...],
  "is_playing": true,
  "spotify_connected": true
}
```

### POST `/api/admin/queue/add`
Add track to Spotify queue.

**Body:**
```json
{
  "uri": "spotify:track:..."
}
```

### POST `/api/admin/playback/pause`
Pause Spotify playback.

### POST `/api/admin/playback/resume`
Resume Spotify playback.

### POST `/api/admin/playback/skip`
Skip to next track.

### POST `/api/admin/add-random-song`
Add random popular song to requests.

### GET `/api/admin/event-settings`
Get current event settings.

### PUT `/api/admin/event-settings`
Update event settings.

**Body:**
```json
{
  "event_title": "Party Title",
  "request_pin": "1234",
  "max_requests_per_user": 3,
  "decline_explicit": true,
  "theme_primary_color": "#10b981",
  "theme_secondary_color": "#000000"
}
```

### POST `/api/admin/message`
Create/update display message.

**Body:**
```json
{
  "text": "Message text",
  "duration": 30 // seconds, null for permanent
}
```

### POST `/api/admin/spotify-watcher`
Start/stop Spotify polling watcher.

**Body:**
```json
{
  "action": "start|stop|status"
}
```

---

## Spotify Endpoints

### GET `/api/spotify/auth`
Initiate Spotify OAuth flow.

**Response:** Redirects to Spotify authorization

### GET `/api/spotify/callback`
OAuth callback from Spotify.

### GET `/api/spotify/status`
Get Spotify connection status.

**Response:**
```json
{
  "connected": true,
  "user": {
    "display_name": "DJ Name",
    "email": "dj@spotify.com"
  }
}
```

### POST `/api/spotify/disconnect`
Disconnect Spotify account.

### GET `/api/spotify/devices`
List available Spotify devices.

**Response:**
```json
{
  "devices": [
    {
      "id": "device_id",
      "name": "Device Name",
      "type": "Computer",
      "is_active": true
    }
  ]
}
```

### POST `/api/spotify/transfer-playback`
Transfer playback to device.

**Body:**
```json
{
  "device_id": "device_id"
}
```

---

## Event Endpoints

### GET `/api/event/status`
Get global event status (multi-tenant).

**Response:**
```json
{
  "status": "live|standby|offline",
  "pagesEnabled": {
    "display": true,
    "requests": true
  }
}
```

### POST `/api/event/pages`
Enable/disable event pages.

**Body:**
```json
{
  "display": true,
  "requests": true
}
```

### POST `/api/events/verify-pin`
Verify request PIN.

**Body:**
```json
{
  "pin": "1234",
  "username": "djname"
}
```

---

## Superadmin Endpoints

### GET `/api/superadmin/users`
List all users (superadmin only).

**Response:**
```json
[
  {
    "id": "uuid",
    "username": "djname",
    "email": "dj@example.com",
    "role": "user",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### PUT `/api/superadmin/users/[id]`
Update user (superadmin only).

### DELETE `/api/superadmin/users/[id]`
Delete user (superadmin only).

### POST `/api/superadmin/party-simulator`
Control party simulator.

**Body:**
```json
{
  "action": "start|stop|status",
  "environment": "local|production",
  "username": "djname",
  "requestPin": "1234",
  "requestInterval": 300000,
  "uniqueRequesters": 5,
  "burstMode": true,
  "explicitSongs": false
}
```

### POST `/api/superadmin/party-simulator/trigger`
Manually trigger simulation requests.

**Body:**
```json
{
  "type": "single|burst"
}
```

---

## Monitoring Endpoints

### GET `/api/monitoring/health`
System health check.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "pusher": "connected",
  "timestamp": "2025-10-17T12:00:00Z"
}
```

### GET `/api/monitoring/metrics`
System metrics (superadmin only).

---

## WebSocket (Pusher) Events

### `request-approved`
Fired when request is approved.

**Payload:**
```json
{
  "id": "uuid",
  "track_name": "Song",
  "artist_name": "Artist",
  "requester_nickname": "John",
  "track_uri": "spotify:track:..."
}
```

### `request-submitted`
Fired when new request is submitted.

### `playback-update`
Fired when Spotify playback changes.

**Payload:**
```json
{
  "current_track": { ... },
  "queue": [ ... ],
  "is_playing": true,
  "progress_ms": 60000
}
```

### `event-state-change`
Fired when event status changes.

**Payload:**
```json
{
  "status": "live|standby|offline",
  "pagesEnabled": {
    "display": true,
    "requests": true
  }
}
```

---

## Error Responses

All endpoints follow this error format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE", // Optional
  "details": { ... } // Optional
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

---

## Rate Limiting

**Public Endpoints:** 100 requests per 15 minutes per IP  
**Authenticated Endpoints:** 1000 requests per 15 minutes per user  
**Spotify API:** Respects Spotify rate limits with exponential backoff

---

## CORS

**Allowed Origins:** Same-origin only  
**Credentials:** Required for authenticated endpoints

---

## Versioning

API version is currently unversioned. Breaking changes will be communicated via:
- GitHub releases
- Documentation updates
- Migration guides

---

**Last Updated:** October 17, 2025

