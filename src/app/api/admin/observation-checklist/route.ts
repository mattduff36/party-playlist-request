/**
 * Observed beta checklist persistence (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';
import {
  emptyObservationChecklist,
  OBSERVATION_ITEMS,
  type ObservationChecklistState,
} from '@/lib/beta/observation-checklist';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, event_id, checklist, notes, updated_at
     FROM beta_observation_checklists
     WHERE organiser_user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [auth.user.user_id]
  );

  if (!result.rows[0]) {
    return NextResponse.json({
      success: true,
      items: OBSERVATION_ITEMS,
      checklist: emptyObservationChecklist(),
      notes: null,
      id: null,
    });
  }

  return NextResponse.json({
    success: true,
    items: OBSERVATION_ITEMS,
    id: result.rows[0].id,
    eventId: result.rows[0].event_id,
    checklist: result.rows[0].checklist || emptyObservationChecklist(),
    notes: result.rows[0].notes,
    updatedAt: result.rows[0].updated_at,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const body = await req.json();
  const checklist = (body.checklist ||
    emptyObservationChecklist()) as ObservationChecklistState;
  const notes = typeof body.notes === 'string' ? body.notes : null;
  const eventId = typeof body.eventId === 'string' ? body.eventId : null;
  const pool = getPool();

  const existing = await pool.query(
    `SELECT id FROM beta_observation_checklists
     WHERE organiser_user_id = $1
     ORDER BY updated_at DESC LIMIT 1`,
    [auth.user.user_id]
  );

  if (existing.rows[0]) {
    await pool.query(
      `UPDATE beta_observation_checklists
       SET checklist = $2::jsonb, notes = $3, event_id = COALESCE($4::uuid, event_id),
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, JSON.stringify(checklist), notes, eventId]
    );
    return NextResponse.json({
      success: true,
      id: existing.rows[0].id,
      checklist,
      notes,
    });
  }

  const inserted = await pool.query(
    `INSERT INTO beta_observation_checklists
       (organiser_user_id, event_id, checklist, notes)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id`,
    [auth.user.user_id, eventId, JSON.stringify(checklist), notes]
  );

  return NextResponse.json({
    success: true,
    id: inserted.rows[0].id,
    checklist,
    notes,
  });
}
