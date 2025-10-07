import { Pool } from 'pg';
import crypto from 'crypto';

export interface Request {
  id: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  requester_ip_hash: string;
  requester_nickname?: string;
  user_session_id?: string; // For tracking user notifications
  status: 'pending' | 'approved' | 'rejected' | 'queued' | 'failed' | 'played';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  spotify_added_to_queue: boolean;
  spotify_added_to_playlist: boolean;
}

export interface Settings {
  [key: string]: string;
}

export interface Admin {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface SpotifyAuth {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  token_type: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  type: 'approval' | 'rejection' | 'info';
  message: string;
  requester_name?: string;
  track_name?: string;
  created_at: string;
  shown: boolean;
}

export interface EventSettings {
  id: number;
  event_title: string;
  dj_name: string;
  venue_info: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  show_qr_code: boolean;
  display_refresh_interval: number;
  // Polling intervals (in seconds)
  admin_polling_interval: number;
  display_polling_interval: number;
  now_playing_polling_interval: number;
  sse_update_interval: number;
  // Admin settings
  request_limit: number;
  auto_approve: boolean;
  force_polling: boolean;
  // Page control settings
  requests_page_enabled: boolean;
  display_page_enabled: boolean;
  // Message system
  message_text: string | null;
  message_duration: number | null;
  message_created_at: Date | null;
  updated_at: string;
}

// Database connection
let pool: Pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// Initialize database tables
export async function initializeDatabase() {
  const client = getPool();
  
  try {
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        track_uri TEXT NOT NULL,
        track_name TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        album_name TEXT,
        duration_ms INTEGER NOT NULL,
        requester_ip_hash TEXT NOT NULL,
        requester_nickname TEXT,
        user_session_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by TEXT,
        rejection_reason TEXT,
        spotify_added_to_queue BOOLEAN DEFAULT FALSE,
        spotify_added_to_playlist BOOLEAN DEFAULT FALSE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS spotify_auth (
        id INTEGER PRIMARY KEY DEFAULT 1,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMP,
        scope TEXT,
        token_type TEXT DEFAULT 'Bearer',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS event_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        event_title TEXT DEFAULT 'Party DJ Requests',
        dj_name TEXT DEFAULT '',
        venue_info TEXT DEFAULT '',
        welcome_message TEXT DEFAULT 'Request your favorite songs!',
        secondary_message TEXT DEFAULT 'Your requests will be reviewed by the DJ',
        tertiary_message TEXT DEFAULT 'Keep the party going!',
        show_qr_code BOOLEAN DEFAULT TRUE,
        display_refresh_interval INTEGER DEFAULT 20,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    // Migration: Update status constraint to include 'played'
    try {
      await client.query(`
        ALTER TABLE requests 
        DROP CONSTRAINT IF EXISTS requests_status_check;
      `);
      
      await client.query(`
        ALTER TABLE requests 
        ADD CONSTRAINT requests_status_check 
        CHECK (status IN ('pending', 'approved', 'rejected', 'queued', 'failed', 'played'));
      `);
      
      console.log('✅ Database constraint updated to include "played" status');
    } catch (migrationError) {
      console.log('ℹ️ Status constraint migration already applied or not needed');
    }

    // Migration: Add polling interval columns to event_settings
    try {
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS admin_polling_interval INTEGER DEFAULT 15;
      `);
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS display_polling_interval INTEGER DEFAULT 20;
      `);
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS now_playing_polling_interval INTEGER DEFAULT 5;
      `);
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS sse_update_interval INTEGER DEFAULT 3;
      `);
      
      console.log('✅ Polling interval columns added to event_settings');
    } catch (migrationError) {
      console.log('ℹ️ Polling interval columns migration already applied or not needed');
    }

    // Migration: Add admin settings columns
    try {
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS request_limit INTEGER DEFAULT 10;
      `);
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT FALSE;
      `);
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS force_polling BOOLEAN DEFAULT FALSE;
      `);
      
      console.log('✅ Admin settings columns added to event_settings');
    } catch (migrationError) {
      console.log('ℹ️ Admin settings columns migration already applied or not needed');
    }

    // Migration: Add page control columns to event_settings
    try {
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS requests_page_enabled BOOLEAN DEFAULT FALSE;
      `);
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS display_page_enabled BOOLEAN DEFAULT FALSE;
      `);
      
      console.log('✅ Page control columns added to event_settings');
    } catch (migrationError) {
      console.log('ℹ️ Page control columns migration already applied or not needed');
    }

    // Migration: Add message system columns to event_settings
    try {
      console.log('🔧 Starting message system migration...');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS message_text TEXT DEFAULT NULL;
      `);
      console.log('✅ message_text column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS message_duration INTEGER DEFAULT NULL;
      `);
      console.log('✅ message_duration column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS message_created_at TIMESTAMP DEFAULT NULL;
      `);
      console.log('✅ message_created_at column added');
      
      console.log('✅ Message system columns migration completed successfully');
    } catch (migrationError) {
      console.error('❌ Message system columns migration failed:', migrationError);
      console.log('ℹ️ This might be expected if columns already exist');
    }

    // Migration: Add user_session_id column to requests for notification tracking
    try {
      console.log('🔧 Starting user session tracking migration...');
      
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS user_session_id TEXT DEFAULT NULL;
      `);
      console.log('✅ user_session_id column added to requests table');
      
      console.log('✅ User session tracking migration completed successfully');
    } catch (migrationError) {
      console.error('❌ User session tracking migration failed:', migrationError);
      console.log('ℹ️ This might be expected if column already exists');
    }

    // Migration: Add display customization columns to event_settings
    try {
      console.log('🔧 Starting display customization migration...');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS decline_explicit BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ decline_explicit column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS qr_boost_duration INTEGER DEFAULT 5;
      `);
      console.log('✅ qr_boost_duration column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS theme_primary_color TEXT DEFAULT '#9333ea';
      `);
      console.log('✅ theme_primary_color column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS theme_secondary_color TEXT DEFAULT '#3b82f6';
      `);
      console.log('✅ theme_secondary_color column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS theme_tertiary_color TEXT DEFAULT '#4f46e5';
      `);
      console.log('✅ theme_tertiary_color column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS show_scrolling_bar BOOLEAN DEFAULT TRUE;
      `);
      console.log('✅ show_scrolling_bar column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS karaoke_mode BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ karaoke_mode column added');
      
      console.log('✅ Display customization columns migration completed successfully');
    } catch (migrationError) {
      console.error('❌ Display customization columns migration failed:', migrationError);
      console.log('ℹ️ This might be expected if columns already exist');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        state TEXT PRIMARY KEY,
        code_verifier TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('approval', 'rejection', 'info')),
        message TEXT NOT NULL,
        requester_name TEXT,
        track_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        shown BOOLEAN DEFAULT FALSE
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at)`);

    // Insert default settings
    await client.query(`
      INSERT INTO settings (key, value) VALUES 
        ('party_playlist_id', ''),
        ('target_device_id', ''),
        ('party_name', 'Party DJ Requests'),
        ('max_requests_per_ip_per_hour', '10'),
        ('request_cooldown_seconds', '30')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Request operations
export async function createRequest(request: Omit<Request, 'id' | 'created_at'>): Promise<Request> {
  const client = getPool();
  const id = crypto.randomUUID();
  
  const result = await client.query(`
    INSERT INTO requests (
      id, track_uri, track_name, artist_name, album_name, 
      duration_ms, requester_ip_hash, requester_nickname, user_session_id,
      status, spotify_added_to_queue, spotify_added_to_playlist
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    id, request.track_uri, request.track_name, request.artist_name, 
    request.album_name, request.duration_ms, request.requester_ip_hash, 
    request.requester_nickname, request.user_session_id, request.status, false, false
  ]);

  return result.rows[0];
}

export async function getRequest(id: string, userId?: string): Promise<Request | null> {
  const client = getPool();
  
  // If userId provided, ensure ownership (multi-tenant isolation)
  if (userId) {
    const result = await client.query('SELECT * FROM requests WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rows[0] || null;
  }
  
  // Legacy: return any (for backward compatibility during migration)
  const result = await client.query('SELECT * FROM requests WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// Helper: Verify request ownership
export async function verifyRequestOwnership(requestId: string, userId: string): Promise<boolean> {
  const client = getPool();
  const result = await client.query('SELECT id FROM requests WHERE id = $1 AND user_id = $2', [requestId, userId]);
  return result.rows.length > 0;
}

export async function updateRequest(id: string, updates: Partial<Request>): Promise<Request | null> {
  const client = getPool();
  
  const setClause = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(', ');
  
  const values = [id, ...Object.values(updates)];
  
  const result = await client.query(`
    UPDATE requests SET ${setClause} WHERE id = $1 RETURNING *
  `, values);
  
  return result.rows[0] || null;
}

export async function getRequestsByStatus(status: string, limit = 50, offset = 0, userId?: string): Promise<Request[]> {
  const client = getPool();
  
  // For approved requests, order by approved_at ASC (oldest approved first - play order)
  // For other statuses, order by created_at DESC (newest first)
  let orderBy = 'created_at DESC';
  if (status === 'approved') {
    orderBy = 'approved_at ASC';
  } else if (status === 'played') {
    orderBy = 'approved_at DESC'; // Most recently played first
  }
  
  // If userId provided, filter by it for multi-tenant isolation
  if (userId) {
    const result = await client.query(
      `SELECT * FROM requests WHERE status = $1 AND user_id = $2 ORDER BY ${orderBy} LIMIT $3 OFFSET $4`,
      [status, userId, limit, offset]
    );
    return result.rows;
  }
  
  // Legacy: return all (for backward compatibility during migration)
  const result = await client.query(
    `SELECT * FROM requests WHERE status = $1 ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );
  return result.rows;
}

export async function getAllRequests(limit = 50, offset = 0, userId?: string): Promise<Request[]> {
  const client = getPool();
  
  // If userId provided, filter by it for multi-tenant isolation
  if (userId) {
    const result = await client.query(
      'SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }
  
  // Legacy: return all (for backward compatibility during migration)
  const result = await client.query(
    'SELECT * FROM requests ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

export async function checkRecentDuplicate(trackUri: string, minutesAgo: number = 30): Promise<Request | null> {
  const client = getPool();
  const result = await client.query(
    `SELECT * FROM requests 
     WHERE track_uri = $1 
     AND created_at > NOW() - INTERVAL '${minutesAgo} minutes'
     AND status IN ('pending', 'approved', 'queued')
     LIMIT 1`,
    [trackUri]
  );
  return result.rows[0] || null;
}

export async function getRequestsCount(userId?: string): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
  const client = getPool();
  
  // If userId provided, filter by it for multi-tenant isolation
  if (userId) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
      FROM requests
      WHERE user_id = $1
    `, [userId]);
    
    return {
      total: parseInt(result.rows[0].total),
      pending: parseInt(result.rows[0].pending),
      approved: parseInt(result.rows[0].approved),
      rejected: parseInt(result.rows[0].rejected)
    };
  }
  
  // Legacy: count all (for backward compatibility during migration)
  const result = await client.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected
    FROM requests
  `);
  
  return {
    total: parseInt(result.rows[0].total),
    pending: parseInt(result.rows[0].pending),
    approved: parseInt(result.rows[0].approved),
    rejected: parseInt(result.rows[0].rejected)
  };
}

// Settings operations
export async function getSetting(key: string): Promise<string | null> {
  const client = getPool();
  const result = await client.query('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows[0]?.value || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const client = getPool();
  await client.query(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
  `, [key, value]);
}

export async function getAllSettings(): Promise<Settings> {
  const client = getPool();
  const result = await client.query('SELECT key, value FROM settings');
  
  const settings: Settings = {};
  result.rows.forEach(row => {
    settings[row.key] = row.value;
  });
  
  return settings;
}

// Admin operations
export async function getAdmin(username: string): Promise<Admin | null> {
  const client = getPool();
  const result = await client.query('SELECT * FROM admins WHERE username = $1', [username]);
  return result.rows[0] || null;
}

export async function createAdmin(admin: Admin): Promise<void> {
  const client = getPool();
  await client.query(`
    INSERT INTO admins (id, username, password_hash, created_at, is_active)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
    ON CONFLICT (username) DO NOTHING
  `, [admin.id, admin.username, admin.password_hash, admin.is_active]);
}

export async function updateAdminLastLogin(username: string): Promise<void> {
  const client = getPool();
  await client.query(
    'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE username = $1',
    [username]
  );
}

// Spotify auth operations
export async function getSpotifyAuth(userId?: string): Promise<SpotifyAuth | null> {
  const client = getPool();
  
  if (userId) {
    const result = await client.query('SELECT * FROM spotify_auth WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }
  
  // Fallback for single-tenant compatibility (shouldn't be used in multi-tenant)
  const result = await client.query('SELECT * FROM spotify_auth LIMIT 1');
  return result.rows[0] || null;
}

export async function setSpotifyAuth(auth: SpotifyAuth, userId: string): Promise<void> {
  const client = getPool();
  await client.query(`
    INSERT INTO spotify_auth (user_id, access_token, refresh_token, expires_at, scope, token_type, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET 
      access_token = $2, refresh_token = $3, expires_at = $4, 
      scope = $5, token_type = $6, updated_at = CURRENT_TIMESTAMP
  `, [userId, auth.access_token, auth.refresh_token, auth.expires_at, auth.scope, auth.token_type]);
}

export async function clearSpotifyAuth(userId?: string): Promise<void> {
  const client = getPool();
  
  if (userId) {
    await client.query('DELETE FROM spotify_auth WHERE user_id = $1', [userId]);
  } else {
    // Fallback for single-tenant compatibility
    await client.query('DELETE FROM spotify_auth');
  }
}

// OAuth session management
export async function storeOAuthSession(state: string, codeVerifier: string, userId?: string, username?: string): Promise<void> {
  const client = getPool();
  
  // Check if user_id and username columns exist
  try {
    await client.query(`
      INSERT INTO oauth_sessions (state, code_verifier, user_id, username)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (state) DO UPDATE SET 
        code_verifier = $2,
        user_id = $3,
        username = $4,
        created_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes'
    `, [state, codeVerifier, userId || null, username || null]);
  } catch (error) {
    // Fallback for old schema without user_id/username columns
    await client.query(`
      INSERT INTO oauth_sessions (state, code_verifier)
      VALUES ($1, $2)
      ON CONFLICT (state) DO UPDATE SET 
        code_verifier = $2, 
        created_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes'
    `, [state, codeVerifier]);
  }
}

export async function getOAuthSession(state: string): Promise<{ code_verifier: string; username?: string } | null> {
  const client = getPool();
  
  // Try to get username if column exists
  try {
    const result = await client.query(`
      SELECT code_verifier, username FROM oauth_sessions
      WHERE state = $1 AND expires_at > CURRENT_TIMESTAMP
    `, [state]);
    
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    // Fallback for old schema
    const result = await client.query(`
      SELECT code_verifier FROM oauth_sessions 
      WHERE state = $1 AND expires_at > CURRENT_TIMESTAMP
    `, [state]);
    
    return result.rows[0] || null;
  }
}

export async function clearOAuthSession(state: string): Promise<void> {
  const client = getPool();
  await client.query('DELETE FROM oauth_sessions WHERE state = $1', [state]);
}

export async function cleanupExpiredOAuthSessions(): Promise<void> {
  const client = getPool();
  await client.query('DELETE FROM oauth_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
}

// Event Settings functions
export async function getEventSettings(): Promise<EventSettings> {
  const client = getPool();
  const result = await client.query('SELECT * FROM event_settings WHERE id = 1');
  
  if (result.rows.length === 0) {
    // Create default settings if none exist
    await client.query(`
      INSERT INTO event_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);
    const newResult = await client.query('SELECT * FROM event_settings WHERE id = 1');
    return newResult.rows[0];
  }
  
  return result.rows[0];
}

export async function updateEventSettings(settings: Partial<Omit<EventSettings, 'id' | 'updated_at'>>): Promise<EventSettings> {
  const client = getPool();
  
  const fields = Object.keys(settings).filter(key => settings[key as keyof typeof settings] !== undefined);
  const values = fields.map(field => settings[field as keyof typeof settings]);
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  
  console.log('💾 [DB] updateEventSettings called with:', {
    fieldsCount: fields.length,
    fields: fields,
    values: values
  });
  
  if (fields.length === 0) {
    console.log('⚠️ [DB] No fields to update, returning current settings');
    return getEventSettings();
  }
  
  const query = `
    UPDATE event_settings 
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = 1
  `;
  
  console.log('💾 [DB] Executing query:', query);
  console.log('💾 [DB] With values:', values);
  
  await client.query(query, values);
  
  console.log('✅ [DB] Event settings updated successfully');
  
  return getEventSettings();
}

// Utility functions
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default-salt')).digest('hex');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

// Notification functions
export async function createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'shown'>): Promise<string> {
  const client = await pool.connect();
  try {
    const id = generateUUID();
    const created_at = new Date().toISOString();
    
    const result = await client.query(
      `INSERT INTO notifications (id, type, message, requester_name, track_name, created_at, shown) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [id, notification.type, notification.message, notification.requester_name, notification.track_name, created_at, false]
    );
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

export async function getNotifications(): Promise<Notification[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM notifications WHERE shown = false ORDER BY created_at ASC LIMIT 5'
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function markNotificationAsShown(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE notifications SET shown = true WHERE id = $1',
      [id]
    );
  } finally {
    client.release();
  }
}

// Initialize default data
export async function initializeDefaults(): Promise<void> {
  await initializeDatabase();

  // Create default admin if it doesn't exist and password is provided
  if (process.env.ADMIN_PASSWORD) {
    const existingAdmin = await getAdmin('admin');
    if (!existingAdmin) {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      
      await createAdmin({
        id: 'admin-001',
        username: 'admin',
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        is_active: true,
      });
    }
  }
}