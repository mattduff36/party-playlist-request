-- Party DJ Request System Database Schema

-- Table for storing song requests
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    track_uri TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_name TEXT,
    duration_ms INTEGER NOT NULL,
    requester_ip_hash TEXT NOT NULL,
    requester_nickname TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'queued', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    approved_by TEXT,
    rejection_reason TEXT,
    spotify_added_to_queue BOOLEAN DEFAULT FALSE,
    spotify_added_to_playlist BOOLEAN DEFAULT FALSE
);

-- Table for storing application settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing admin users (for future multi-admin support)
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table for storing Spotify tokens and auth data
CREATE TABLE IF NOT EXISTS spotify_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME,
    scope TEXT,
    token_type TEXT DEFAULT 'Bearer',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_requester_ip ON requests(requester_ip_hash);
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('party_playlist_id', ''),
    ('target_device_id', ''),
    ('admin_password_hash', ''),
    ('party_name', 'Party DJ Requests'),
    ('max_requests_per_ip_per_hour', '10'),
    ('request_cooldown_seconds', '30');

-- Insert default admin user (password will be set via environment variable)
INSERT OR IGNORE INTO admins (id, username, password_hash) VALUES 
    ('admin-001', 'admin', '');