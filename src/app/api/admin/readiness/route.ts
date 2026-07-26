/**
 * Event readiness wizard state (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool, getEventSettings } from '@/lib/db';
import { getPlaybackMode } from '@/lib/playback';
import {
  emptyReadinessState,
  evaluateReadiness,
  mergeCheckUpdate,
  parseReadinessState,
  type ReadinessCheckState,
  type ReadinessState,
} from '@/lib/beta/readiness';
import { emitSecurityAudit } from '@/lib/auth/security-audit';

async function loadEventRow(userId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, status, version, lifecycle_phase, readiness_state, readiness_score,
            scheduled_start_at, venue_label, template_id, readiness_override, config
     FROM events WHERE user_id = $1
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function spotifySnapshot(userId: string): Promise<{
  connected: boolean;
  hasDevice: boolean;
}> {
  try {
    const { getSpotifyAuth } = await import('@/lib/db');
    const auth = await getSpotifyAuth(userId);
    if (!auth) return { connected: false, hasDevice: false };

    const pool = getPool();
    const device = await pool.query(
      `SELECT device_id FROM events WHERE user_id = $1 AND device_id IS NOT NULL LIMIT 1`,
      [userId]
    );
    return {
      connected: true,
      hasDevice: Boolean(device.rows[0]?.device_id),
    };
  } catch {
    return { connected: false, hasDevice: false };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const userId = auth.user.user_id;
  const event = await loadEventRow(userId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const state = parseReadinessState(event.readiness_state);
  const mode = await getPlaybackMode(userId);
  const settings = await getEventSettings(userId);
  const spotify = await spotifySnapshot(userId);
  const evaluation = evaluateReadiness({
    state,
    playbackMode: mode,
    spotifyConnected: spotify.connected,
    hasActiveDevice: spotify.hasDevice,
    eventTitle: settings.event_title || event.config?.event_title || '',
    allowWarningOverride: Boolean(event.readiness_override?.allowed),
    overrideReason: event.readiness_override?.reason || state.readyOverrideReason,
  });

  return NextResponse.json({
    success: true,
    eventId: event.id,
    lifecyclePhase: event.lifecycle_phase || 'draft',
    readinessScore: evaluation.score,
    state,
    evaluation,
    scheduledStartAt: event.scheduled_start_at,
    venueLabel: event.venue_label,
    templateId: event.template_id,
    playbackMode: mode,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const userId = auth.user.user_id;
  const body = await req.json();
  const event = await loadEventRow(userId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  let state: ReadinessState = parseReadinessState(event.readiness_state);
  const pool = getPool();

  if (typeof body.currentStep === 'number') {
    state = { ...state, currentStep: body.currentStep };
  }

  if (body.check && typeof body.check === 'object') {
    const check = body.check as ReadinessCheckState;
    if (!check.id) {
      return NextResponse.json({ error: 'check.id required' }, { status: 400 });
    }
    state = mergeCheckUpdate(state, check);
  }

  if (body.basics && typeof body.basics === 'object') {
    const basics = body.basics as {
      eventTitle?: string;
      venueLabel?: string;
      scheduledStartAt?: string | null;
    };
    if (basics.eventTitle) {
      const { updateEventSettings } = await import('@/lib/db');
      await updateEventSettings({ event_title: basics.eventTitle }, userId);
    }
    await pool.query(
      `UPDATE events
       SET venue_label = COALESCE($2, venue_label),
           scheduled_start_at = COALESCE($3::timestamptz, scheduled_start_at),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $4`,
      [
        event.id,
        basics.venueLabel ?? null,
        basics.scheduledStartAt ?? null,
        userId,
      ]
    );
    state = mergeCheckUpdate(state, {
      id: 'basics',
      completed: Boolean(basics.eventTitle || event.config?.event_title),
    });
  }

  if (body.markReady === true) {
    const mode = await getPlaybackMode(userId);
    const settings = await getEventSettings(userId);
    const spotify = await spotifySnapshot(userId);
    const allowWarningOverride = Boolean(body.allowWarningOverride);
    const overrideReason =
      typeof body.overrideReason === 'string' ? body.overrideReason : null;

    const evaluation = evaluateReadiness({
      state,
      playbackMode: mode,
      spotifyConnected: spotify.connected,
      hasActiveDevice: spotify.hasDevice,
      eventTitle: settings.event_title || '',
      allowWarningOverride,
      overrideReason,
    });

    if (!evaluation.canMarkReady) {
      return NextResponse.json(
        {
          error: 'Event cannot be marked ready while required checks fail',
          code: 'READINESS_BLOCKED',
          evaluation,
        },
        { status: 409 }
      );
    }

    state = {
      ...state,
      markedReadyAt: new Date().toISOString(),
      readyOverrideReason: allowWarningOverride ? overrideReason : null,
      checks: {
        ...state.checks,
        ready_confirm: {
          id: 'ready_confirm',
          completed: true,
          updatedAt: new Date().toISOString(),
        },
      },
    };

    const overridePayload =
      allowWarningOverride && overrideReason
        ? { allowed: true, reason: overrideReason, at: new Date().toISOString() }
        : null;

    await pool.query(
      `UPDATE events
       SET readiness_state = $2::jsonb,
           readiness_score = $3,
           lifecycle_phase = 'ready',
           readiness_override = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $5`,
      [
        event.id,
        JSON.stringify(state),
        evaluation.score,
        overridePayload ? JSON.stringify(overridePayload) : null,
        userId,
      ]
    );

    emitSecurityAudit('event.readiness_ready', {
      correlationId: auth.correlationId,
      userId,
      eventId: event.id,
      meta: {
        score: evaluation.score,
        override: Boolean(overridePayload),
      },
    });

    return NextResponse.json({
      success: true,
      lifecyclePhase: 'ready',
      state,
      evaluation,
    });
  }

  const mode = await getPlaybackMode(userId);
  const settings = await getEventSettings(userId);
  const spotify = await spotifySnapshot(userId);
  const evaluation = evaluateReadiness({
    state,
    playbackMode: mode,
    spotifyConnected: spotify.connected,
    hasActiveDevice: spotify.hasDevice,
    eventTitle: settings.event_title || '',
  });

  await pool.query(
    `UPDATE events
     SET readiness_state = $2::jsonb,
         readiness_score = $3,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $4`,
    [event.id, JSON.stringify(state), evaluation.score, userId]
  );

  return NextResponse.json({
    success: true,
    state,
    evaluation,
    lifecyclePhase: event.lifecycle_phase || 'draft',
  });
}
