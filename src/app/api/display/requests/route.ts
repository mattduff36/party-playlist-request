import { NextResponse } from 'next/server';

/**
 * Legacy unprotected display requests route — permanently retired (PRD-01).
 * Use GET /api/public/requests with guest/display access instead.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      code: 'LEGACY_DISPLAY_RETIRED',
      message:
        'This endpoint has been permanently removed. Use /api/public/requests with guest access.',
    },
    { status: 410 }
  );
}
