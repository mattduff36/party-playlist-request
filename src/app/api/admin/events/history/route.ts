/**
 * Archived / ended event history list (PRD-08).
 * Not tied to browser login/logout — server event archive stamps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { listArchivedEvents } from '@/lib/beta/event-report';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const events = await listArchivedEvents(auth.user.user_id);
  return NextResponse.json({ success: true, events });
}
