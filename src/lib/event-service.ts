/**
 * Event Management Service
 * Handles user events, access codes, bypass tokens (legacy), and display tokens
 */

import { getPool } from '@/lib/db';
import crypto from 'crypto';
import { generateAccessCode } from '@/lib/access-code';
import {
  dualVerifySecret,
  getAccessCodeHmacVersion,
  hashOpaqueToken,
  hmacAccessCode,
  tokenPrefix,
} from '@/lib/crypto/secret-hashes';

// ============================================================================
// Types
// ============================================================================

export interface UserEvent {
  id: string;
  user_id: string;
  name: string | null;
  /** @deprecated use access_code — DB column still named pin */
  pin: string;
  /** Per-event guest URL secret (6-digit or secure alphanumeric) */
  access_code: string;
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

function mapUserEvent(row: Record<string, unknown>): UserEvent {
  const code = String(row.access_code || row.pin || '');
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: (row.name as string | null) ?? null,
    pin: code,
    access_code: code,
    bypass_token: String(row.bypass_token || ''),
    active: Boolean(row.active),
    started_at: row.started_at as Date,
    ended_at: (row.ended_at as Date | null) ?? null,
    expires_at: row.expires_at as Date,
    created_at: row.created_at as Date,
  };
}

// ============================================================================
// Token Generation
// ============================================================================

function generateBypassToken(): string {
  return `bp_${crypto.randomBytes(29).toString('hex')}`;
}

function generateDisplayToken(): string {
  return `dt_${crypto.randomBytes(29).toString('hex')}`;
}

async function getSecureUrlAccessPreference(userId: string): Promise<boolean> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT secure_url_access FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    return Boolean(result.rows[0]?.secure_url_access);
  } catch {
    return false;
  }
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

    return mapUserEvent(result.rows[0]);
  } catch (error) {
    console.error('❌ Failed to get active event:', error);
    throw error;
  }
}

/**
 * Create a new event for a user
 * Automatically deactivates any existing active events
 * Resets display mood to DJ Tool so each new event starts from the default theme
 */
export async function createEvent(
  userId: string,
  eventName?: string
): Promise<UserEvent> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE user_events 
       SET active = false, ended_at = NOW() 
       WHERE user_id = $1 AND active = true`,
      [userId]
    );

    const secure = await getSecureUrlAccessPreference(userId);
    const accessCode = generateAccessCode(secure);
    const bypassToken = generateBypassToken();
    const accessCodeHmac = hmacAccessCode(accessCode);
    const bypassTokenHash = hashOpaqueToken(bypassToken);
    const hmacVersion = getAccessCodeHmacVersion();

    // pin/access_code plaintext retained for Class B dual-read / organiser redisplay
    let result;
    try {
      result = await client.query(
        `INSERT INTO user_events (
           user_id, name, pin, access_code, bypass_token, active, expires_at,
           access_code_hmac, access_code_hmac_version, bypass_token_hash
         )
         VALUES ($1, $2, $3, $3, $4, true, NOW() + INTERVAL '24 hours', $5, $6, $7)
         RETURNING *`,
        [
          userId,
          eventName || null,
          accessCode,
          bypassToken,
          accessCodeHmac,
          hmacVersion,
          bypassTokenHash,
        ]
      );
    } catch {
      result = await client.query(
        `INSERT INTO user_events (user_id, name, pin, bypass_token, active, expires_at)
         VALUES ($1, $2, $3, $4, true, NOW() + INTERVAL '24 hours')
         RETURNING *`,
        [userId, eventName || null, accessCode, bypassToken]
      );
    }

    const { DEFAULT_DISPLAY_MOOD } = await import('@/styles/theme');
    await client.query(
      `INSERT INTO user_settings (user_id, display_mood)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET display_mood = $2, updated_at = NOW()`,
      [userId, DEFAULT_DISPLAY_MOOD]
    );

    await client.query('COMMIT');

    console.log(`✅ Created new event for user ${userId} (access code redacted)`);

    try {
      const { getEventSettings } = await import('@/lib/db');
      const { triggerEvent, getUserChannel } = await import('@/lib/pusher');
      const { getGuestEventChannel } = await import(
        '@/lib/pusher/channel-contract'
      );
      const settings = await getEventSettings(userId);
      const payload = {
        settings,
        timestamp: Date.now(),
        userId,
      };
      await triggerEvent(getUserChannel(userId), 'settings-update', payload);
      const created = mapUserEvent(result.rows[0]);
      await triggerEvent(
        getGuestEventChannel(created.id),
        'settings-update',
        payload
      );
    } catch (pusherError) {
      console.error('Failed to broadcast mood reset after createEvent:', pusherError);
    }

    return mapUserEvent(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create event:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Regenerate the access code for the active event (e.g. secure-mode toggle).
 */
export async function regenerateActiveEventAccessCode(
  userId: string
): Promise<UserEvent | null> {
  const pool = getPool();
  const secure = await getSecureUrlAccessPreference(userId);
  const accessCode = generateAccessCode(secure);
  const bypassToken = generateBypassToken();
  const accessCodeHmac = hmacAccessCode(accessCode);
  const bypassTokenHash = hashOpaqueToken(bypassToken);
  const hmacVersion = getAccessCodeHmacVersion();

  try {
    let result;
    try {
      result = await pool.query(
        `UPDATE user_events
         SET pin = $2, access_code = $2, bypass_token = $3,
             access_code_hmac = $4, access_code_hmac_version = $5,
             bypass_token_hash = $6
         WHERE user_id = $1 AND active = true AND expires_at > NOW()
         RETURNING *`,
        [
          userId,
          accessCode,
          bypassToken,
          accessCodeHmac,
          hmacVersion,
          bypassTokenHash,
        ]
      );
    } catch {
      result = await pool.query(
        `UPDATE user_events
         SET pin = $2, bypass_token = $3
         WHERE user_id = $1 AND active = true AND expires_at > NOW()
         RETURNING *`,
        [userId, accessCode, bypassToken]
      );
    }

    if (result.rows.length === 0) {
      return null;
    }

    console.log(`✅ Regenerated access code for user ${userId} (redacted)`);
    return mapUserEvent(result.rows[0]);
  } catch (error) {
    console.error('❌ Failed to regenerate access code:', error);
    throw error;
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
    // Rotate/revoke display tokens when event ends (PRD-04)
    await pool.query(
      `UPDATE display_tokens
       SET uses_remaining = 0
       WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );

    console.log(`✅ Ended event ${eventId}`);
  } catch (error) {
    console.error('❌ Failed to end event:', error);
    throw error;
  }
}

/**
 * End every active guest-access event for a user (DJ Event Control → Offline).
 * Prevents GET /api/events/current from resurrecting the previous access code.
 * Also clears the single-admin-session lock — event over ⇒ session done for this lock.
 */
export async function endAllActiveEventsForUser(userId: string): Promise<number> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE user_events
       SET active = false, ended_at = NOW()
       WHERE user_id = $1 AND active = true
       RETURNING id`,
      [userId]
    );
    const count = result.rowCount ?? result.rows.length;
    if (count > 0) {
      const eventIds = result.rows.map((r: { id: string }) => r.id);
      await pool.query(
        `UPDATE display_tokens
         SET uses_remaining = 0
         WHERE user_id = $1 AND event_id = ANY($2::uuid[])`,
        [userId, eventIds]
      );
      console.log(`✅ Ended ${count} active user_event(s) for user ${userId}`);
    }

    await clearActiveAdminSessionForUser(userId);

    return count;
  } catch (error) {
    console.error('❌ Failed to end active events for user:', error);
    throw error;
  }
}

/**
 * Clear the single-admin-session lock on users (active_session_*).
 * Used when the event ends (offline) so re-login does not show a stale transfer modal.
 */
export async function clearActiveAdminSessionForUser(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE users
     SET active_session_id = NULL,
         active_session_created_at = NULL
     WHERE id = $1`,
    [userId]
  );
  console.log(`✅ Cleared active admin session lock for user ${userId}`);
}

// ============================================================================
// Access code verification
// ============================================================================

/**
 * Verify access code for a user's event (also accepts legacy 4-digit PIN).
 */
export async function verifyAccessCode(
  username: string,
  accessCode: string
): Promise<UserEvent | null> {
  try {
    const pool = getPool();
    // Load candidate active events for username; dual-verify HMAC then plaintext
    const result = await pool.query(
      `SELECT e.* FROM user_events e
       INNER JOIN users u ON u.id = e.user_id
       WHERE u.username = $1
       AND e.active = true
       AND e.expires_at > NOW()
       LIMIT 5`,
      [username]
    );

    for (const row of result.rows) {
      const plain = String(row.access_code || row.pin || '');
      const ok = dualVerifySecret({
        presented: accessCode,
        storedHash: row.access_code_hmac ? String(row.access_code_hmac) : null,
        storedPlaintext: plain || null,
        hashFn: hmacAccessCode,
      });
      if (ok) {
        return mapUserEvent(row);
      }
    }

    return null;
  } catch (error) {
    // access_code_hmac column may not exist yet — plaintext equality fallback
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT e.* FROM user_events e
         INNER JOIN users u ON u.id = e.user_id
         WHERE u.username = $1
         AND (
           e.pin = $2
           OR COALESCE(e.access_code, '') = $2
         )
         AND e.active = true
         AND e.expires_at > NOW()
         LIMIT 1`,
        [username, accessCode]
      );
      if (result.rows.length === 0) return null;
      return mapUserEvent(result.rows[0]);
    } catch (fallbackError) {
      console.error('❌ Failed to verify access code:', fallbackError);
      throw fallbackError;
    }
  }
}

/** @deprecated use verifyAccessCode */
export async function verifyPIN(username: string, pin: string): Promise<UserEvent | null> {
  return verifyAccessCode(username, pin);
}

/**
 * Verify bypass token for a user's event (legacy QR links)
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
       AND e.active = true
       AND e.expires_at > NOW()
       LIMIT 5`,
      [username]
    );

    for (const row of result.rows) {
      const ok = dualVerifySecret({
        presented: bypassToken,
        storedHash: row.bypass_token_hash
          ? String(row.bypass_token_hash)
          : null,
        storedPlaintext: row.bypass_token ? String(row.bypass_token) : null,
        hashFn: hashOpaqueToken,
      });
      if (ok) {
        return mapUserEvent(row);
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to verify bypass token:', error);
    throw error;
  }
}

// ============================================================================
// Display Token Management
// ============================================================================

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
    const tokenHash = hashOpaqueToken(token);
    const prefix = tokenPrefix(token);

    let result;
    try {
      result = await pool.query(
        `INSERT INTO display_tokens (
           event_id, user_id, token, token_hash, token_prefix, uses_remaining, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [eventId, userId, token, tokenHash, prefix, usesRemaining, expiresAt]
      );
    } catch {
      result = await pool.query(
        `INSERT INTO display_tokens (event_id, user_id, token, uses_remaining, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [eventId, userId, token, usesRemaining, expiresAt]
      );
    }

    console.log(`✅ Created display token for event ${eventId}`);
    return result.rows[0] as DisplayToken;
  } catch (error) {
    console.error('❌ Failed to create display token:', error);
    throw error;
  }
}

export async function verifyDisplayToken(
  username: string,
  displayToken: string
): Promise<{ event: UserEvent; token: DisplayToken } | null> {
  const pool = getPool();
  const tokenHash = hashOpaqueToken(displayToken);

  // Atomic consume: UPDATE … WHERE uses_remaining > 0 … RETURNING
  // Dual-verify: match token_hash OR legacy plaintext token column
  let result;
  try {
    result = await pool.query(
      `UPDATE display_tokens dt
       SET uses_remaining = uses_remaining - 1, last_used_at = NOW()
       FROM user_events e
       INNER JOIN users u ON u.id = e.user_id
       WHERE dt.event_id = e.id
         AND u.username = $1
         AND dt.uses_remaining > 0
         AND dt.expires_at > NOW()
         AND e.active = true
         AND e.expires_at > NOW()
         AND (
           dt.token_hash = $2
           OR (dt.token_hash IS NULL AND dt.token = $3)
         )
       RETURNING dt.id as token_id, dt.event_id, dt.user_id as token_user_id,
                 dt.token, dt.uses_remaining as token_uses, dt.expires_at as token_expires,
                 dt.created_at as token_created, dt.last_used_at as token_last_used,
                 e.id as event_id, e.user_id as event_user_id, e.name, e.pin,
                 e.access_code, e.bypass_token, e.active, e.started_at, e.ended_at,
                 e.expires_at, e.created_at`,
      [username, tokenHash, displayToken]
    );
  } catch {
    // Columns may not exist yet — plaintext atomic consume
    result = await pool.query(
      `UPDATE display_tokens dt
       SET uses_remaining = uses_remaining - 1, last_used_at = NOW()
       FROM user_events e
       INNER JOIN users u ON u.id = e.user_id
       WHERE dt.event_id = e.id
         AND u.username = $1
         AND dt.token = $2
         AND dt.uses_remaining > 0
         AND dt.expires_at > NOW()
         AND e.active = true
         AND e.expires_at > NOW()
       RETURNING dt.id as token_id, dt.event_id, dt.user_id as token_user_id,
                 dt.token, dt.uses_remaining as token_uses, dt.expires_at as token_expires,
                 dt.created_at as token_created, dt.last_used_at as token_last_used,
                 e.id as event_id, e.user_id as event_user_id, e.name, e.pin,
                 e.access_code, e.bypass_token, e.active, e.started_at, e.ended_at,
                 e.expires_at, e.created_at`,
      [username, displayToken]
    );
  }

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const event = mapUserEvent({
    id: row.event_id,
    user_id: row.event_user_id,
    name: row.name,
    pin: row.pin,
    access_code: row.access_code,
    bypass_token: row.bypass_token,
    active: row.active,
    started_at: row.started_at,
    ended_at: row.ended_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  });

  const token: DisplayToken = {
    id: row.token_id,
    event_id: row.event_id,
    user_id: row.token_user_id,
    token: row.token,
    uses_remaining: row.token_uses,
    expires_at: row.token_expires,
    created_at: row.token_created,
    last_used_at: row.token_last_used,
  };

  console.log(`✅ Verified display token for event ${event.id}`);
  return { event, token };
}

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
