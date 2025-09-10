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
  updated_at: string;
}

// Database connection
let pool: Pool;

function getPool() {
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
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'queued', 'failed')),
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
      duration_ms, requester_ip_hash, requester_nickname, 
      status, spotify_added_to_queue, spotify_added_to_playlist
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    id, request.track_uri, request.track_name, request.artist_name, 
    request.album_name, request.duration_ms, request.requester_ip_hash, 
    request.requester_nickname, request.status, false, false
  ]);

  return result.rows[0];
}

export async function getRequest(id: string): Promise<Request | null> {
  const client = getPool();
  const result = await client.query('SELECT * FROM requests WHERE id = $1', [id]);
  return result.rows[0] || null;
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

export async function getRequestsByStatus(status: string, limit = 50, offset = 0): Promise<Request[]> {
  const client = getPool();
  const result = await client.query(
    'SELECT * FROM requests WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [status, limit, offset]
  );
  return result.rows;
}

export async function getAllRequests(limit = 50, offset = 0): Promise<Request[]> {
  const client = getPool();
  const result = await client.query(
    'SELECT * FROM requests ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

export async function getRequestsCount(): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
  const client = getPool();
  
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
export async function getSpotifyAuth(): Promise<SpotifyAuth | null> {
  const client = getPool();
  const result = await client.query('SELECT * FROM spotify_auth WHERE id = 1');
  return result.rows[0] || null;
}

export async function setSpotifyAuth(auth: SpotifyAuth): Promise<void> {
  const client = getPool();
  await client.query(`
    INSERT INTO spotify_auth (id, access_token, refresh_token, expires_at, scope, token_type, updated_at)
    VALUES (1, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET 
      access_token = $1, refresh_token = $2, expires_at = $3, 
      scope = $4, token_type = $5, updated_at = CURRENT_TIMESTAMP
  `, [auth.access_token, auth.refresh_token, auth.expires_at, auth.scope, auth.token_type]);
}

export async function clearSpotifyAuth(): Promise<void> {
  const client = getPool();
  await client.query('DELETE FROM spotify_auth WHERE id = 1');
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
  
  if (fields.length === 0) {
    return getEventSettings();
  }
  
  await client.query(`
    UPDATE event_settings 
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = 1
  `, values);
  
  return getEventSettings();
}

// Utility functions
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default-salt')).digest('hex');
}

export function generateUUID(): string {
  return crypto.randomUUID();
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