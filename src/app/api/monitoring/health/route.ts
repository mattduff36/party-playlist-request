/**
 * Public liveness probe (PRD-01).
 * Minimal JSON only — detailed health is superadmin via dashboard / support health.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
