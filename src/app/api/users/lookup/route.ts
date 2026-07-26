/**
 * User Lookup API — retired for public UUID disclosure (PRD-04).
 *
 * Public pages must subscribe via event-scoped private channels after
 * guest/display proof, not by discovering organiser UUIDs.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'User lookup by username is no longer available',
      code: 'USER_LOOKUP_RETIRED',
      hint: 'Subscribe with private-event-{eventId}-guest after access-code verification, or use an authenticated admin session for admin channels.',
    },
    { status: 410 }
  );
}
