/**
 * Interactive demo mode toggle (PRD-08).
 * Uses mock tracks; never touches production Spotify credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool, getEventSettings } from '@/lib/db';
import { isDemoModeEnabled, searchDemoTracks } from '@/lib/beta/demo-mode';
import { setPlaybackMode } from '@/lib/playback';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const settings = await getEventSettings(auth.user.user_id);
  const enabled = isDemoModeEnabled(
    settings as { demo_mode?: boolean | null }
  );
  const q = new URL(req.url).searchParams.get('q') || '';

  return NextResponse.json({
    success: true,
    demoMode: enabled,
    tracks: enabled ? searchDemoTracks(q) : [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const body = await req.json();
  const enabled = Boolean(body.enabled);
  const userId = auth.user.user_id;
  const pool = getPool();

  // Toggle only flips demo_mode (+ manual playback when enabling).
  // Spotify credential guards belong on OAuth/vault paths, not this toggle.

  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await pool.query(
    `UPDATE user_settings
     SET demo_mode = $2, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, enabled]
  );

  if (enabled) {
    // Demo uses manual-style requests + mock catalogue — no Spotify OAuth
    await setPlaybackMode(userId, 'manual');
  }

  return NextResponse.json({
    success: true,
    demoMode: enabled,
    note: enabled
      ? 'Demo mode uses mock tracks only; Spotify credentials are not read or written.'
      : 'Demo mode disabled.',
  });
}
