/**
 * Event templates (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { EVENT_TEMPLATES, getEventTemplate } from '@/lib/beta/templates';
import { updateEventSettings, getPool } from '@/lib/db';
import { emitSecurityAudit } from '@/lib/auth/security-audit';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  return NextResponse.json({
    success: true,
    templates: EVENT_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const body = await req.json();
  const templateId = String(body.templateId || '');
  const template = getEventTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
  }

  const userId = auth.user.user_id;
  await updateEventSettings(
    {
      event_title: template.settings.event_title,
      welcome_message: template.settings.welcome_message,
      secondary_message: template.settings.secondary_message,
      venue_info: template.settings.venue_info,
      auto_approve: template.settings.auto_approve,
      decline_explicit: template.settings.decline_explicit,
      request_limit: template.settings.request_limit,
      display_mood: template.settings.display_mood as never,
    },
    userId
  );

  const pool = getPool();
  await pool.query(
    `UPDATE events
     SET template_id = $2,
         lifecycle_phase = CASE
           WHEN lifecycle_phase = 'archived' THEN lifecycle_phase
           ELSE 'draft'
         END,
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, template.id]
  );

  emitSecurityAudit('event.template_applied', {
    correlationId: auth.correlationId,
    userId,
    meta: { template_id: template.id },
  });

  return NextResponse.json({
    success: true,
    templateId: template.id,
    settings: template.settings,
  });
}
