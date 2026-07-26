/**
 * Post-event report + optional CSV (PRD-08).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { buildRequestsCsv, getFullEventReport } from '@/lib/beta/event-report';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(req);
  if (!auth.authenticated || !auth.user) return auth.response!;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');

  if (format === 'csv') {
    const csv = await buildRequestsCsv(auth.user.user_id, id);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${id}-requests.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const report = await getFullEventReport(auth.user.user_id, id);
  if (!report) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    report,
    note: 'uniqueGuestSessionsApprox is approximate (distinct guest session ids).',
  });
}
