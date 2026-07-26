import { NextResponse } from 'next/server';

/**
 * Legacy unprotected display route — permanently retired (PRD-01).
 * Use access-code-gated public APIs instead:
 * - GET /api/public/display-data
 * - GET /api/public/playback-sync
 * - GET /api/public/event-config
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      code: 'LEGACY_DISPLAY_RETIRED',
      message:
        'This endpoint has been permanently removed. Use /api/public/display-data with guest access.',
    },
    { status: 410 }
  );
}
