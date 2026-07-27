/**
 * One-shot Class C backfill (safer expand-and-contract variant).
 *
 * Usage:
 *   npx tsx scripts/backfill-prd03-prd04-class-c.ts --confirm
 *   npm run db:backfill:class-c -- --confirm
 *
 * PRD-03: encrypt Spotify plaintext into envelopes + token_key_version.
 *   Does NOT null/clear plaintext (main still dual-reads plaintext).
 * PRD-04: backfill hash/HMAC columns from plaintext where hash is null.
 *   Does NOT clear plaintext.
 *
 * Never runs Class D (column drops). Logs counts only — no secret values.
 * Requires --confirm and TOKEN_ENCRYPTION_KEY_V1 (Spotify path).
 */

import { config } from 'dotenv';
import { closePool, getPool } from '../src/lib/db';
import {
  encryptToken,
  getTokenVaultWriteKid,
  serializeEnvelope,
} from '../src/lib/crypto/token-vault';
import {
  getAccessCodeHmacVersion,
  hashOpaqueToken,
  hmacAccessCode,
  tokenPrefix,
} from '../src/lib/crypto/secret-hashes';

config({ path: '.env.local' });
config();

interface Counts {
  spotifyCandidates: number;
  spotifyUpdated: number;
  spotifySkippedAlreadyEnveloped: number;
  oauthPkceCandidates: number;
  oauthPkceUpdated: number;
  accessCodeHmacUpdated: number;
  bypassHashUpdated: number;
  displayTokenHashUpdated: number;
  passwordResetHashUpdated: number;
  emailVerifyHashUpdated: number;
}

function requireConfirm(): void {
  if (!process.argv.includes('--confirm')) {
    console.error(
      'Refusing to run without --confirm. This writes Class C backfill to the live shared Neon DB.'
    );
    console.error(
      'Example: npx tsx scripts/backfill-prd03-prd04-class-c.ts --confirm'
    );
    process.exit(1);
  }
}

async function backfillSpotify(pool: ReturnType<typeof getPool>, counts: Counts): Promise<void> {
  if (!process.env.TOKEN_ENCRYPTION_KEY_V1?.trim()) {
    throw new Error('TOKEN_ENCRYPTION_KEY_V1 is required for Spotify envelope backfill');
  }

  const kid = getTokenVaultWriteKid();
  const candidates = await pool.query<{
    user_id: string;
    access_token: string | null;
    refresh_token: string | null;
    access_token_envelope: string | null;
    refresh_token_envelope: string | null;
  }>(
    `
    SELECT user_id, access_token, refresh_token,
           access_token_envelope, refresh_token_envelope
    FROM spotify_auth
    WHERE (
      (access_token IS NOT NULL AND btrim(access_token) <> '')
      OR (refresh_token IS NOT NULL AND btrim(refresh_token) <> '')
    )
    `
  );

  counts.spotifyCandidates = candidates.rowCount ?? candidates.rows.length;

  for (const row of candidates.rows) {
    const userId = String(row.user_id);
    const needsAccess =
      !!row.access_token?.trim() && !row.access_token_envelope?.trim();
    const needsRefresh =
      !!row.refresh_token?.trim() && !row.refresh_token_envelope?.trim();

    if (!needsAccess && !needsRefresh) {
      counts.spotifySkippedAlreadyEnveloped += 1;
      continue;
    }

    const accessEnvelope = needsAccess
      ? serializeEnvelope(
          encryptToken({
            plaintext: row.access_token!.trim(),
            userId,
            purpose: 'spotify.access',
          })
        )
      : null;
    const refreshEnvelope = needsRefresh
      ? serializeEnvelope(
          encryptToken({
            plaintext: row.refresh_token!.trim(),
            userId,
            purpose: 'spotify.refresh',
          })
        )
      : null;

    // Expand-only: write envelopes / key version; leave plaintext intact.
    await pool.query(
      `
      UPDATE spotify_auth SET
        access_token_envelope = COALESCE($2, access_token_envelope),
        refresh_token_envelope = COALESCE($3, refresh_token_envelope),
        token_key_version = COALESCE(token_key_version, $4),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      `,
      [userId, accessEnvelope, refreshEnvelope, kid]
    );
    counts.spotifyUpdated += 1;
  }
}

async function backfillOauthPkce(
  pool: ReturnType<typeof getPool>,
  counts: Counts
): Promise<void> {
  const candidates = await pool.query<{
    state: string;
    user_id: string;
    code_verifier: string;
  }>(
    `
    SELECT state, user_id, code_verifier
    FROM oauth_sessions
    WHERE code_verifier IS NOT NULL
      AND btrim(code_verifier) <> ''
      AND (code_verifier_encrypted IS NULL OR btrim(code_verifier_encrypted) = '')
      AND user_id IS NOT NULL
    `
  );

  counts.oauthPkceCandidates = candidates.rowCount ?? candidates.rows.length;

  for (const row of candidates.rows) {
    const userId = String(row.user_id);
    const stateHash = String(row.state);
    const envelope = serializeEnvelope(
      encryptToken({
        plaintext: row.code_verifier,
        userId,
        purpose: 'spotify.pkce',
        aadExtra: stateHash,
      })
    );
    await pool.query(
      `
      UPDATE oauth_sessions
      SET code_verifier_encrypted = $2
      WHERE state = $1
        AND (code_verifier_encrypted IS NULL OR btrim(code_verifier_encrypted) = '')
      `,
      [stateHash, envelope]
    );
    counts.oauthPkceUpdated += 1;
  }
}

async function backfillPrd04Hashes(
  pool: ReturnType<typeof getPool>,
  counts: Counts
): Promise<void> {
  const hmacVersion = getAccessCodeHmacVersion();

  const events = await pool.query<{
    id: string;
    pin: string | null;
    access_code: string | null;
    bypass_token: string | null;
    access_code_hmac: string | null;
    bypass_token_hash: string | null;
  }>(
    `
    SELECT id, pin, access_code, bypass_token, access_code_hmac, bypass_token_hash
    FROM user_events
    WHERE (
      (access_code_hmac IS NULL OR btrim(access_code_hmac) = '')
      AND (
        (access_code IS NOT NULL AND btrim(access_code) <> '')
        OR (pin IS NOT NULL AND btrim(pin) <> '')
      )
    )
    OR (
      (bypass_token_hash IS NULL OR btrim(bypass_token_hash) = '')
      AND bypass_token IS NOT NULL AND btrim(bypass_token) <> ''
    )
    `
  );

  for (const row of events.rows) {
    const plainCode = (row.access_code || row.pin || '').trim();
    const needsHmac = !row.access_code_hmac?.trim() && !!plainCode;
    const needsBypass =
      !row.bypass_token_hash?.trim() && !!row.bypass_token?.trim();

    if (!needsHmac && !needsBypass) continue;

    const hmac = needsHmac ? hmacAccessCode(plainCode) : null;
    const bypassHash = needsBypass
      ? hashOpaqueToken(row.bypass_token!.trim())
      : null;

    await pool.query(
      `
      UPDATE user_events SET
        access_code_hmac = COALESCE($2, access_code_hmac),
        access_code_hmac_version = CASE
          WHEN $2 IS NOT NULL THEN COALESCE(access_code_hmac_version, $4)
          ELSE access_code_hmac_version
        END,
        bypass_token_hash = COALESCE($3, bypass_token_hash)
      WHERE id = $1
      `,
      [row.id, hmac, bypassHash, hmacVersion]
    );

    if (needsHmac) counts.accessCodeHmacUpdated += 1;
    if (needsBypass) counts.bypassHashUpdated += 1;
  }

  const display = await pool.query<{ id: string; token: string }>(
    `
    SELECT id, token
    FROM display_tokens
    WHERE token IS NOT NULL AND btrim(token) <> ''
      AND (token_hash IS NULL OR btrim(token_hash) = '')
    `
  );

  for (const row of display.rows) {
    const token = row.token.trim();
    await pool.query(
      `
      UPDATE display_tokens
      SET token_hash = $2, token_prefix = COALESCE(token_prefix, $3)
      WHERE id = $1
        AND (token_hash IS NULL OR btrim(token_hash) = '')
      `,
      [row.id, hashOpaqueToken(token), tokenPrefix(token)]
    );
    counts.displayTokenHashUpdated += 1;
  }

  const resets = await pool.query<{ id: string; token: string }>(
    `
    SELECT id, token
    FROM password_reset_tokens
    WHERE token IS NOT NULL AND btrim(token) <> ''
      AND (token_hash IS NULL OR btrim(token_hash) = '')
    `
  );

  for (const row of resets.rows) {
    await pool.query(
      `
      UPDATE password_reset_tokens
      SET token_hash = $2
      WHERE id = $1
        AND (token_hash IS NULL OR btrim(token_hash) = '')
      `,
      [row.id, hashOpaqueToken(row.token.trim())]
    );
    counts.passwordResetHashUpdated += 1;
  }

  const emails = await pool.query<{ id: string; email_verification_token: string }>(
    `
    SELECT id, email_verification_token
    FROM users
    WHERE email_verification_token IS NOT NULL
      AND btrim(email_verification_token) <> ''
      AND (
        email_verification_token_hash IS NULL
        OR btrim(email_verification_token_hash) = ''
      )
    `
  );

  for (const row of emails.rows) {
    await pool.query(
      `
      UPDATE users
      SET email_verification_token_hash = $2
      WHERE id = $1
        AND (
          email_verification_token_hash IS NULL
          OR btrim(email_verification_token_hash) = ''
        )
      `,
      [row.id, hashOpaqueToken(row.email_verification_token.trim())]
    );
    counts.emailVerifyHashUpdated += 1;
  }
}

async function main(): Promise<void> {
  requireConfirm();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const counts: Counts = {
    spotifyCandidates: 0,
    spotifyUpdated: 0,
    spotifySkippedAlreadyEnveloped: 0,
    oauthPkceCandidates: 0,
    oauthPkceUpdated: 0,
    accessCodeHmacUpdated: 0,
    bypassHashUpdated: 0,
    displayTokenHashUpdated: 0,
    passwordResetHashUpdated: 0,
    emailVerifyHashUpdated: 0,
  };

  const pool = getPool();
  try {
    console.log(
      'Starting Class C backfill (expand-only; plaintext retained; Class D skipped)…'
    );
    await backfillSpotify(pool, counts);
    await backfillOauthPkce(pool, counts);
    await backfillPrd04Hashes(pool, counts);
    console.log(
      JSON.stringify(
        {
          variant: 'expand-only-dual-write',
          plaintextNulled: false,
          classD: 'skipped',
          counts,
        },
        null,
        2
      )
    );
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
