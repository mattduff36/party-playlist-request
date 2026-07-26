/**
 * Must-play / do-not-play / cooldown guardrails (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';
import {
  guestGuardrailExplanation,
  loadGuardrailSettings,
  type GuardrailTrackRef,
} from '@/lib/beta/guardrails';
import { emitSecurityAudit } from '@/lib/auth/security-audit';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const settings = await loadGuardrailSettings(auth.user.user_id);
  return NextResponse.json({
    success: true,
    settings,
    guestExplanation: guestGuardrailExplanation(settings),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const body = await req.json();
  const userId = auth.user.user_id;
  const pool = getPool();

  const mustPlay = Array.isArray(body.must_play_list)
    ? (body.must_play_list as GuardrailTrackRef[])
    : undefined;
  const doNotPlay = Array.isArray(body.do_not_play_list)
    ? (body.do_not_play_list as GuardrailTrackRef[])
    : undefined;
  const artistCooldown =
    body.artist_cooldown_minutes !== undefined
      ? Number(body.artist_cooldown_minutes)
      : undefined;
  const maxActive =
    body.max_active_requests_per_guest !== undefined
      ? body.max_active_requests_per_guest === null
        ? null
        : Number(body.max_active_requests_per_guest)
      : undefined;

  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await pool.query(
    `UPDATE user_settings SET
       must_play_list = COALESCE($2::jsonb, must_play_list),
       do_not_play_list = COALESCE($3::jsonb, do_not_play_list),
       artist_cooldown_minutes = COALESCE($4, artist_cooldown_minutes),
       max_active_requests_per_guest = CASE
         WHEN $5::boolean THEN $6
         ELSE max_active_requests_per_guest
       END,
       updated_at = NOW()
     WHERE user_id = $1`,
    [
      userId,
      mustPlay !== undefined ? JSON.stringify(mustPlay) : null,
      doNotPlay !== undefined ? JSON.stringify(doNotPlay) : null,
      artistCooldown !== undefined && !Number.isNaN(artistCooldown)
        ? artistCooldown
        : null,
      maxActive !== undefined,
      maxActive,
    ]
  );

  if (body.organiserOverrideAudit) {
    emitSecurityAudit('event.guardrail_override', {
      correlationId: auth.correlationId,
      userId,
      meta: {
        reason:
          typeof body.organiserOverrideAudit === 'string'
            ? body.organiserOverrideAudit
            : 'override',
      },
    });
  }

  const settings = await loadGuardrailSettings(userId);
  return NextResponse.json({
    success: true,
    settings,
    guestExplanation: guestGuardrailExplanation(settings),
  });
}
