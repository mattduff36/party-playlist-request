/**
 * Event Management Service
 * Handles user events, PINs, bypass tokens, and display tokens
 */

import { getPool } from '@/lib/db';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface UserEvent {
  id: string;
  user_id: string;
  name: string | null;
  pin: string;
  bypass_token: string;
  active: boolean;
  started_at: Date;
  ended_at: Date | null;
  expires_at: Date;
  created_at: Date;
}

export interface DisplayToken {
  id: string;
  event_id: string;
  user_id: string;
  token: string;
  uses_remaining: number;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date | null;
}

// ============================================================================
// PIN Generation (with pattern avoidance)
// ============================================================================

const AVOIDED_PATTERNS = [
  '1234', '4321', '0000', '1111', '2222', '3333', '4444', '5555', 
  '6666', '7777', '8888', '9999', '1212', '6969', '0420'
];

function generateSecurePIN(): string {
  let pin: string;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (AVOIDED_PATTERNS.includes(pin));
  return pin;
}

// ============================================================================
// Token Generation
// ============================================================================

function generateBypassToken(): string {
  // Generate 29 bytes (58 hex chars) + "bp_" prefix = 61 chars total (under 64 limit)
  return `bp_${crypto.randomBytes(29).toString('hex')}`;
}

function generateDisplayToken(): string {
  // Generate 29 bytes (58 hex chars) + "dt_" prefix = 61 chars total (under 64 limit)
  return `dt_${crypto.randomBytes(29).toString('hex')}`;
}

// ============================================================================
// Event Management
// ============================================================================

/**
 * Get the active event for a user
 */
export async function getActiveEvent(userId: string): Promise<UserEvent | null> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM user_events 
       WHERE user_id = $1 AND active = true 
       AND expires_at > NOW()
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserEvent;
  } catch (error) {
    console.error('❌ Failed to get active event:', error);
    throw error;
  }
}

/**
 * Create a new event for a user
 * Automatically deactivates any existing active events
 */
export async function createEvent(
  userId: string, 
  eventName?: string
): Promise<UserEvent> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Deactivate any existing active events
    await client.query(
      `UPDATE user_events 
       SET active = false, ended_at = NOW() 
       WHERE user_id = $1 AND active = true`,
      [userId]
    );

    // Generate PIN and bypass token
    const pin = generateSecurePIN();
    const bypassToken = generateBypassToken();

    // Create new event
    const result = await client.query(
      `INSERT INTO user_events (user_id, name, pin, bypass_token, active, expires_at)
       VALUES ($1, $2, $3, $4, true, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [userId, eventName || null, pin, bypassToken]
    );

    await client.query('COMMIT');

    console.log(`✅ Created new event for user ${userId}, PIN: ${pin}`);
    return result.rows[0] as UserEvent;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create event:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * End an event (set active = false)
 */
export async function endEvent(eventId: string, userId: string): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE user_events 
       SET active = false, ended_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [eventId, userId]
    );

    console.log(`✅ Ended event ${eventId}`);
  } catch (error) {
    console.error('❌ Failed to end event:', error);
    throw error;
  }
}

// ============================================================================
// PIN Verification
// ============================================================================

/**
 * Verify PIN for a user's event
 * Returns the event if PIN is correct
 */
export async function verifyPIN(username: string, pin: string): Promise<UserEvent | null> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT e.* FROM user_events e
       INNER JOIN users u ON u.id = e.user_id
       WHERE u.username = $1 
       AND e.pin = $2 
       AND e.active = true 
       AND e.expires_at > NOW()
       LIMIT 1`,
      [username, pin]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserEvent;
  } catch (error) {
    console.error('❌ Failed to verify PIN:', error);
    throw error;
  }
}

// ============================================================================
// Bypass Token Verification
// ============================================================================

/**
 * Verify bypass token for a user's event
 * Returns the event if token is valid
 */
export async function verifyBypassToken(
  username: string, 
  bypassToken: string
): Promise<UserEvent | null> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT e.* FROM user_events e
       INNER JOIN users u ON u.id = e.user_id
       WHERE u.username = $1 
       AND e.bypass_token = $2 
       AND e.active = true 
       AND e.expires_at > NOW()
       LIMIT 1`,
      [username, bypassToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserEvent;
  } catch (error) {
    console.error('❌ Failed to verify bypass token:', error);
    throw error;
  }
}

// ============================================================================
// Display Token Management
// ============================================================================

/**
 * Create a new display token for an event
 * Limited to 3 uses by default
 */
export async function createDisplayToken(
  eventId: string,
  userId: string,
  usesRemaining: number = 3,
  hoursValid: number = 24
): Promise<DisplayToken> {
  try {
    const pool = getPool();
    const token = generateDisplayToken();
    const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO display_tokens (event_id, user_id, token, uses_remaining, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [eventId, userId, token, usesRemaining, expiresAt]
    );

    console.log(`✅ Created display token for event ${eventId}`);
    return result.rows[0] as DisplayToken;

  } catch (error) {
    console.error('❌ Failed to create display token:', error);
    throw error;
  }
}

/**
 * Verify and consume a display token
 * Returns the event if token is valid
 */
export async function verifyDisplayToken(
  username: string,
  displayToken: string
): Promise<{ event: UserEvent; token: DisplayToken } | null> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get token and event
    const result = await client.query(
      `SELECT dt.*, e.*, 
              dt.id as token_id, dt.uses_remaining as token_uses,
              e.id as event_id, e.user_id as event_user_id
       FROM display_tokens dt
       INNER JOIN user_events e ON e.id = dt.event_id
       INNER JOIN users u ON u.id = e.user_id
       WHERE u.username = $1 
       AND dt.token = $2 
       AND dt.uses_remaining > 0 
       AND dt.expires_at > NOW()
       AND e.active = true 
       AND e.expires_at > NOW()
       LIMIT 1`,
      [username, displayToken]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const row = result.rows[0];

    // Decrement uses_remaining
    await client.query(
      `UPDATE display_tokens 
       SET uses_remaining = uses_remaining - 1, last_used_at = NOW() 
       WHERE id = $1`,
      [row.token_id]
    );

    await client.query('COMMIT');

    // Construct return objects
    const event: UserEvent = {
      id: row.event_id,
      user_id: row.event_user_id,
      name: row.name,
      pin: row.pin,
      bypass_token: row.bypass_token,
      active: row.active,
      started_at: row.started_at,
      ended_at: row.ended_at,
      expires_at: row.expires_at,
      created_at: row.created_at
    };

    const token: DisplayToken = {
      id: row.token_id,
      event_id: row.event_id,
      user_id: row.event_user_id,
      token: row.token,
      uses_remaining: row.token_uses - 1, // After decrement
      expires_at: row.expires_at,
      created_at: row.created_at,
      last_used_at: new Date()
    };

    console.log(`✅ Verified display token for event ${event.id}`);
    return { event, token };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to verify display token:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revoke a display token (set uses_remaining to 0)
 */
export async function revokeDisplayToken(tokenId: string, userId: string): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE display_tokens 
       SET uses_remaining = 0 
       WHERE id = $1 AND user_id = $2`,
      [tokenId, userId]
    );

    console.log(`✅ Revoked display token ${tokenId}`);
  } catch (error) {
    console.error('❌ Failed to revoke display token:', error);
    throw error;
  }
}

/**
 * Get all display tokens for an event
 */
export async function getDisplayTokensForEvent(
  eventId: string, 
  userId: string
): Promise<DisplayToken[]> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM display_tokens 
       WHERE event_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [eventId, userId]
    );

    return result.rows as DisplayToken[];
  } catch (error) {
    console.error('❌ Failed to get display tokens:', error);
    throw error;
  }
}

