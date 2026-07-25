import { Pool } from 'pg';
import crypto from 'crypto';
import type { DisplayMood } from '@/styles/theme';

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
  request_limit: number | null;
  auto_approve: boolean;
  decline_explicit: boolean;
  force_polling: boolean;
  // Page control settings
  requests_page_enabled: boolean;
  display_page_enabled: boolean;
  // Message system
  message_text: string | null;
  message_duration: number | null;
  message_created_at: Date | null;
  // Theme customization
  display_mood: DisplayMood | null;
  theme_primary_color: string | null;
  theme_secondary_color: string | null;
  theme_tertiary_color: string | null;
  show_scrolling_bar: boolean;
  qr_boost_duration: number | null;
  karaoke_mode: boolean;
  show_approval_messages: boolean;
  /** When true, guest URLs use an 8-char secure code instead of 6 digits */
  secure_url_access: boolean;
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
        secondary_message TEXT DEFAULT '',
        tertiary_message TEXT DEFAULT '',
        show_qr_code BOOLEAN DEFAULT TRUE,
        display_refresh_interval INTEGER DEFAULT 20,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    // Multi-tenant user settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        event_title TEXT DEFAULT 'Party DJ Requests',
        dj_name TEXT DEFAULT '',
        venue_info TEXT DEFAULT '',
        welcome_message TEXT DEFAULT 'Request your favorite songs!',
        secondary_message TEXT DEFAULT '',
        tertiary_message TEXT DEFAULT '',
        show_qr_code BOOLEAN DEFAULT TRUE,
        display_refresh_interval INTEGER DEFAULT 20,
        admin_polling_interval INTEGER DEFAULT 15,
        display_polling_interval INTEGER DEFAULT 10,
        now_playing_polling_interval INTEGER DEFAULT 5,
        sse_update_interval INTEGER DEFAULT 2,
        request_limit INTEGER DEFAULT 10,
        auto_approve BOOLEAN DEFAULT FALSE,
        decline_explicit BOOLEAN DEFAULT FALSE,
        force_polling BOOLEAN DEFAULT FALSE,
        requests_page_enabled BOOLEAN DEFAULT TRUE,
        display_page_enabled BOOLEAN DEFAULT TRUE,
        message_text TEXT DEFAULT NULL,
        message_duration INTEGER DEFAULT NULL,
        message_created_at TIMESTAMP DEFAULT NULL,
        theme_primary_color TEXT DEFAULT NULL,
        theme_secondary_color TEXT DEFAULT NULL,
        theme_tertiary_color TEXT DEFAULT NULL,
        display_mood TEXT DEFAULT 'dj',
        show_scrolling_bar BOOLEAN DEFAULT TRUE,
        qr_boost_duration INTEGER DEFAULT 5,
        karaoke_mode BOOLEAN DEFAULT FALSE,
        show_approval_messages BOOLEAN DEFAULT FALSE,
        secure_url_access BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Migration: Add missing columns to requests table for existing databases
    try {
      console.log('🔧 Starting requests table schema migration...');
      
      // Add duration_ms if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0;
      `);
      console.log('✅ duration_ms column added/verified');
      
      // Add requester_ip_hash if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS requester_ip_hash TEXT DEFAULT '';
      `);
      console.log('✅ requester_ip_hash column added/verified');
      
      // Add requester_nickname if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS requester_nickname TEXT DEFAULT NULL;
      `);
      console.log('✅ requester_nickname column added/verified');
      
      // Add approved_at if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP DEFAULT NULL;
      `);
      console.log('✅ approved_at column added/verified');
      
      // Add approved_by if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL;
      `);
      console.log('✅ approved_by column added/verified');
      
      // Add rejection_reason if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
      `);
      console.log('✅ rejection_reason column added/verified');
      
      // Add spotify_added_to_queue if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS spotify_added_to_queue BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ spotify_added_to_queue column added/verified');
      
      // Add spotify_added_to_playlist if missing
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS spotify_added_to_playlist BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ spotify_added_to_playlist column added/verified');
      
      console.log('✅ Requests table schema migration completed successfully');
    } catch (migrationError) {
      console.error('❌ Requests table schema migration failed:', migrationError);
      console.log('ℹ️ This might be expected if columns already exist');
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
        ADD COLUMN IF NOT EXISTS theme_primary_color TEXT DEFAULT '#1DB954';
      `);
      console.log('✅ theme_primary_color column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS theme_secondary_color TEXT DEFAULT '#191414';
      `);
      console.log('✅ theme_secondary_color column added');
      
      await client.query(`
        ALTER TABLE event_settings 
        ADD COLUMN IF NOT EXISTS theme_tertiary_color TEXT DEFAULT '#1ed760';
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

    // Migration: Add display customization columns to user_settings
    try {
      console.log('🔧 Starting user_settings display customization migration...');
      
      await client.query(`
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS qr_boost_duration INTEGER DEFAULT 5;
      `);
      console.log('✅ qr_boost_duration column added to user_settings');
      
      await client.query(`
        ALTER TABLE user_settings 
        ADD COLUMN IF NOT EXISTS karaoke_mode BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ karaoke_mode column added to user_settings');
      
      console.log('✅ User settings display customization columns migration completed successfully');
    } catch (migrationError) {
      console.error('❌ User settings display customization columns migration failed:', migrationError);
      console.log('ℹ️ This might be expected if columns already exist');
    }

    // Migration: display_mood (guest/display visual presets) — isolated so earlier ALTER failures cannot skip it
    try {
      await client.query(`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS display_mood TEXT DEFAULT 'dj';
      `);
      await client.query(`
        ALTER TABLE event_settings
        ADD COLUMN IF NOT EXISTS display_mood TEXT DEFAULT 'dj';
      `);
      // Existing installs may still have DEFAULT 'club' from earlier migrations
      await client.query(`
        ALTER TABLE user_settings
        ALTER COLUMN display_mood SET DEFAULT 'dj';
      `);
      await client.query(`
        ALTER TABLE event_settings
        ALTER COLUMN display_mood SET DEFAULT 'dj';
      `);
      console.log('✅ display_mood columns ensured on user_settings and event_settings (default dj)');
    } catch (migrationError) {
      console.error('❌ display_mood migration failed:', migrationError);
    }

    // Migration: secure URL access + widen pin + user_events.access_code
    // pin was VARCHAR(4) for legacy PINs; access codes are 6-digit or 8-char.
    try {
      await client.query(`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS secure_url_access BOOLEAN DEFAULT FALSE;
      `);
      await client.query(`
        ALTER TABLE user_events
        ALTER COLUMN pin TYPE TEXT;
      `);
      // Legacy constraint: pin ~ '^[0-9]{4}$' — blocks 6/8-char access codes
      await client.query(`
        ALTER TABLE user_events
        DROP CONSTRAINT IF EXISTS user_events_pin_check;
      `);
      await client.query(`
        ALTER TABLE user_events
        ADD COLUMN IF NOT EXISTS access_code TEXT;
      `);
      await client.query(`
        ALTER TABLE user_events
        DROP CONSTRAINT IF EXISTS user_events_access_code_format_check;
      `);
      await client.query(`
        ALTER TABLE user_events
        ADD CONSTRAINT user_events_access_code_format_check
        CHECK (
          pin ~ '^[0-9]{4}$'
          OR pin ~ '^[0-9]{6}$'
          OR pin ~ '^[0-9A-HJ-NP-Z]{8}$'
        );
      `);
      await client.query(`
        UPDATE user_events
        SET access_code = pin
        WHERE access_code IS NULL AND pin IS NOT NULL;
      `);
      console.log('✅ secure_url_access + user_events.pin TEXT + access_code ensured');
    } catch (migrationError) {
      console.error('❌ access code migration failed:', migrationError);
    }

    // Empty scrolling message defaults (was prefilled DJ copy)
    try {
      await client.query(`
        ALTER TABLE user_settings
          ALTER COLUMN secondary_message SET DEFAULT '',
          ALTER COLUMN tertiary_message SET DEFAULT '';
      `);
      await client.query(`
        ALTER TABLE event_settings
          ALTER COLUMN secondary_message SET DEFAULT '',
          ALTER COLUMN tertiary_message SET DEFAULT '';
      `);
      console.log('✅ scrolling message column defaults set to empty');
    } catch (migrationError) {
      console.error('❌ scrolling message defaults migration failed:', migrationError);
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

    // Support system: durable errors + activity audit (90-day retention via prune)
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_errors (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'fatal')),
        source TEXT NOT NULL DEFAULT 'unknown'
          CHECK (source IN ('api', 'client', 'spotify', 'db', 'pusher', 'unknown')),
        message TEXT NOT NULL,
        stack TEXT,
        route TEXT,
        method TEXT,
        user_id UUID,
        username TEXT,
        event_id UUID,
        ip_hash TEXT,
        user_agent TEXT,
        meta JSONB,
        fingerprint TEXT,
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        classification TEXT NOT NULL DEFAULT 'unhandled'
          CHECK (classification IN ('handled', 'unhandled')),
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        resolved_by TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS support_activity (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        actor_role TEXT NOT NULL
          CHECK (actor_role IN ('guest', 'admin', 'superadmin', 'system')),
        user_id UUID,
        username TEXT,
        event_id UUID,
        route TEXT,
        ip_hash TEXT,
        summary TEXT NOT NULL,
        meta JSONB
      )
    `);

    // Support errors: fingerprint dedup + handled/unhandled classification
    try {
      await client.query(`
        ALTER TABLE support_errors
          ADD COLUMN IF NOT EXISTS fingerprint TEXT,
          ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'unhandled'
      `);
      await client.query(`
        UPDATE support_errors
        SET last_seen_at = COALESCE(last_seen_at, created_at)
        WHERE last_seen_at IS NULL
      `);
      // Soft-check: allow only known classifications (ignore if constraint already exists)
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE support_errors
            ADD CONSTRAINT support_errors_classification_check
            CHECK (classification IN ('handled', 'unhandled'));
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_support_errors_fingerprint_open
         ON support_errors(fingerprint)
         WHERE resolved = FALSE AND fingerprint IS NOT NULL`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_support_errors_classification_open
         ON support_errors(classification, resolved, last_seen_at DESC)`
      );
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_support_errors_fp_open_unique
         ON support_errors(fingerprint)
         WHERE resolved = FALSE AND fingerprint IS NOT NULL`
      );
      console.log('✅ Support error fingerprint/classification columns ready');
    } catch (migrationError) {
      console.log(
        'ℹ️ Support error fingerprint migration skipped or partial:',
        (migrationError as Error).message
      );
    }

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_support_errors_created ON support_errors(created_at DESC)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_support_errors_unresolved ON support_errors(resolved, created_at DESC)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_support_errors_username ON support_errors(username)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_support_activity_created ON support_activity(created_at DESC)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_support_activity_username ON support_activity(username)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_support_activity_action ON support_activity(action)`
    );

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
export async function createRequest(
  request: Omit<Request, 'id' | 'created_at'>, 
  userId: string
): Promise<Request> {
  const client = getPool();
  const id = crypto.randomUUID();
  
  // SECURITY: Always require user_id for multi-tenant isolation
  if (!userId) {
    throw new Error('user_id is required for multi-tenant data isolation');
  }
  
  // Production database includes user_id for proper multi-tenant isolation
  const result = await client.query(`
    INSERT INTO requests (
      id, track_uri, track_name, artist_name, album_name, duration_ms,
      requester_ip_hash, requester_nickname, user_session_id, status, 
      spotify_added_to_queue, spotify_added_to_playlist, user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [
    id, request.track_uri, request.track_name, request.artist_name, 
    request.album_name, request.duration_ms || 0, request.requester_ip_hash || '',
    request.requester_nickname, request.user_session_id, request.status, 
    request.spotify_added_to_queue || false, request.spotify_added_to_playlist || false, userId
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

export async function updateRequest(id: string, updates: Partial<Request>, userId?: string): Promise<Request | null> {
  const client = getPool();
  
  const setClause = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(', ');
  
  const values = [id, ...Object.values(updates)];
  
  // If userId provided, ensure ownership (multi-tenant isolation)
  if (userId) {
    values.push(userId);
    const result = await client.query(`
      UPDATE requests SET ${setClause} WHERE id = $1 AND user_id = $${values.length} RETURNING *
    `, values);
    return result.rows[0] || null;
  }
  
  // Legacy: update any (for backward compatibility during migration)
  const result = await client.query(`
    UPDATE requests SET ${setClause} WHERE id = $1 RETURNING *
  `, values);
  
  return result.rows[0] || null;
}

// DEPRECATED: Use new getRequestsByStatus below
export async function getRequestsByStatusOld(status: string, limit = 50, offset = 0, userId?: string): Promise<Request[]> {
  const client = getPool();
  
  // For approved requests, order by approved_at ASC (oldest approved first - play order)
  // For other statuses, order by created_at DESC (newest first)
  let orderBy = 'created_at DESC';
  if (status === 'approved') {
    orderBy = 'approved_at ASC';
  } else if (status === 'played') {
    orderBy = 'approved_at DESC'; // Most recently played first
  }
  
  // Single-tenant: ignore userId (not in schema)
  const result = await client.query(
    `SELECT * FROM requests WHERE status = $1 ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );
  return result.rows;
}

// DEPRECATED: Use getRequestsByUserId or getRequestsByStatus instead
export async function getAllRequests(limit = 50, offset = 0, userId?: string): Promise<Request[]> {
  const client = getPool();
  
  // SECURITY: ALWAYS filter by user_id for multi-tenant isolation
  if (!userId) {
    throw new Error('user_id is required for multi-tenant data isolation');
  }
  
  const result = await client.query(
    'SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );
  return result.rows;
}

// OPTIMIZED: Get requests filtered by user ID and optionally by status
export async function getRequestsByUserId(
  userId: string, 
  options?: {
    status?: 'pending' | 'approved' | 'rejected' | 'queued' | 'failed' | 'played';
    limit?: number;
    offset?: number;
  }
): Promise<Request[]> {
  const client = getPool();
  const { status, limit = 50, offset = 0 } = options || {};
  
  // For single-tenant systems (current schema), userId is not in requests table
  // Instead, all requests belong to the single user
  if (status) {
    const result = await client.query(
      'SELECT * FROM requests WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [status, limit, offset]
    );
    return result.rows;
  }
  
  const result = await client.query(
    'SELECT * FROM requests ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

// OPTIMIZED: Get requests by status only (for current single-tenant schema)
export async function getRequestsByStatus(
  status: 'pending' | 'approved' | 'rejected' | 'queued' | 'failed' | 'played',
  limit = 50,
  offset = 0,
  userId?: string
): Promise<Request[]> {
  const client = getPool();
  
  // SECURITY: ALWAYS filter by user_id for multi-tenant isolation
  if (!userId) {
    throw new Error('user_id is required for multi-tenant data isolation');
  }
  
  // For approved requests, order by approved_at ASC (oldest approved first - play order)
  // For other statuses, order by created_at DESC (newest first)
  let orderBy = 'created_at DESC';
  if (status === 'approved') {
    orderBy = 'approved_at ASC';
  } else if (status === 'played') {
    orderBy = 'approved_at DESC'; // Most recently played first
  }
  
  const result = await client.query(
    `SELECT * FROM requests WHERE user_id = $1 AND status = $2 ORDER BY ${orderBy} LIMIT $3 OFFSET $4`,
    [userId, status, limit, offset]
  );
  return result.rows;
}

// OPTIMIZED: Check for recent duplicates (multi-tenant schema)
export async function checkRecentDuplicate(trackUri: string, minutesAgo: number = 30, userId?: string): Promise<Request | null> {
  const client = getPool();
  
  // SECURITY: ALWAYS filter by user_id for multi-tenant isolation
  if (!userId) {
    throw new Error('user_id is required for multi-tenant data isolation');
  }
  
  // OPTIMIZATION: Use parameterized interval instead of string interpolation
  const result = await client.query(
    `SELECT * FROM requests
     WHERE user_id = $1 
     AND track_uri = $2 
     AND created_at > NOW() - INTERVAL '1 minute' * $3
     AND status IN ('pending', 'approved', 'queued')
     LIMIT 1`,
    [userId, trackUri, minutesAgo]
  );
  return result.rows[0] || null;
}

// OPTIMIZED: Get counts with single query (single-tenant schema)
export async function getRequestsCount(userId?: string): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
  const client = getPool();
  
  // SECURITY: ALWAYS filter by user_id for multi-tenant isolation
  if (!userId) {
    throw new Error('user_id is required for multi-tenant data isolation');
  }
  
  // OPTIMIZATION: Single query with FILTER for all counts, scoped to user
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

export async function clearSpotifyAuth(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('userId is required for multi-tenant data isolation');
  }
  
  const client = getPool();
  await client.query('DELETE FROM spotify_auth WHERE user_id = $1', [userId]);
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

// Event Settings functions (MULTI-TENANT!)
export async function getEventSettings(userId?: string): Promise<EventSettings> {
  const client = getPool();
  
  // If userId provided, get user-specific settings
  if (userId) {
    const result = await client.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      // Create default user settings if none exist
      await client.query(`
        INSERT INTO user_settings (user_id) VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);
      const newResult = await client.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
      return { id: 0, ...newResult.rows[0] };
    }
    
    return { id: 0, ...result.rows[0] };
  }
  
  // Fallback to global settings (legacy)
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

const EVENT_SETTINGS_UPDATABLE_FIELDS = new Set([
  'event_title',
  'dj_name',
  'venue_info',
  'welcome_message',
  'secondary_message',
  'tertiary_message',
  'show_qr_code',
  'display_refresh_interval',
  'admin_polling_interval',
  'display_polling_interval',
  'now_playing_polling_interval',
  'sse_update_interval',
  'request_limit',
  'auto_approve',
  'decline_explicit',
  'force_polling',
  'requests_page_enabled',
  'display_page_enabled',
  'message_text',
  'message_duration',
  'message_created_at',
  'display_mood',
  'theme_primary_color',
  'theme_secondary_color',
  'theme_tertiary_color',
  'show_scrolling_bar',
  'qr_boost_duration',
  'karaoke_mode',
  'show_approval_messages',
  'secure_url_access',
]);

export async function updateEventSettings(settings: Partial<Omit<EventSettings, 'id' | 'updated_at'>>, userId?: string): Promise<EventSettings> {
  const client = getPool();
  
  try {
    const fields = Object.keys(settings).filter(
      (key) =>
        EVENT_SETTINGS_UPDATABLE_FIELDS.has(key) &&
        settings[key as keyof typeof settings] !== undefined
    );
    const values = fields.map(field => settings[field as keyof typeof settings]);
    
    console.log('💾 [DB] updateEventSettings called with:', {
      fieldsCount: fields.length,
      fields: fields,
      values: values,
      userId: userId
    });
    
    if (fields.length === 0) {
      console.log('⚠️ [DB] No fields to update, returning current settings');
      return getEventSettings(userId);
    }
    
    // If userId provided, update user-specific settings
    if (userId) {
      console.log('💾 [DB] Ensuring user_settings row exists for userId:', userId);
      
      // First check if user settings exist
      try {
        const checkResult = await client.query(
          'SELECT user_id FROM user_settings WHERE user_id = $1',
          [userId]
        );
        
        if (checkResult.rows.length === 0) {
          console.log('💾 [DB] Creating new user_settings row...');
          await client.query(
            'INSERT INTO user_settings (user_id) VALUES ($1)',
            [userId]
          );
          console.log('✅ [DB] User settings row created');
        } else {
          console.log('✅ [DB] User settings row already exists');
        }
      } catch (insertError) {
        console.error('❌ [DB] Failed to ensure user_settings row:', insertError);
        throw new Error(`Failed to create user settings: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`);
      }
      
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      const query = `
        UPDATE user_settings 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $${fields.length + 1}
      `;
      
      console.log('💾 [DB] Executing user-specific query:', query);
      console.log('💾 [DB] With values:', [...values, userId]);
      
      try {
        await client.query(query, [...values, userId]);
        console.log('✅ [DB] User-specific event settings updated successfully');
      } catch (updateError) {
        console.error('❌ [DB] Failed to update user_settings:', updateError);
        throw new Error(`Failed to update settings: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
      }
      
      return getEventSettings(userId);
    }
    
    // Fallback to global settings (legacy)
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const query = `
      UPDATE event_settings 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `;
    
    console.log('💾 [DB] Executing global query:', query);
    console.log('💾 [DB] With values:', values);
    
    await client.query(query, values);
    
    console.log('✅ [DB] Event settings updated successfully');
    
    return getEventSettings();
  } catch (error) {
    console.error('❌ [DB] updateEventSettings error:', error);
    throw error;
  }
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