/**
 * POST /api/payments/activate — explicit Party Pass activation (PRD-09).
 * Starts the 30-day window. Purchase alone does not activate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import {
  activatePartyPass,
  PartyPassActivationError,
} from '@/lib/payments/entitlement';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const userId = auth.user.user_id;

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'JSON body required', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    const entitlementId =
      typeof body.entitlementId === 'string' ? body.entitlementId : '';
    if (!entitlementId) {
      return NextResponse.json(
        { error: 'entitlementId is required', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Ignore client-supplied starts/expires/duration
    void body.startsAt;
    void body.expiresAt;
    void body.durationDays;

    const eventId =
      typeof body.eventId === 'string' && body.eventId.length > 0
        ? body.eventId
        : null;

    if (body.confirm !== true) {
      return NextResponse.json(
        {
          error:
            'Activation requires confirm: true — this starts your 30-day Party Pass window',
          code: 'CONFIRMATION_REQUIRED',
        },
        { status: 400 }
      );
    }

    const entitlement = await activatePartyPass({
      userId,
      entitlementId,
      eventId,
      actorId: userId,
    });

    return NextResponse.json({
      ok: true,
      entitlement,
      message:
        'Party Pass activated. Your 30-day window has started. Event history remains readable after expiry.',
    });
  } catch (error) {
    if (error instanceof PartyPassActivationError) {
      const status =
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'ALREADY_ACTIVE' || error.code === 'CONFLICT'
            ? 409
            : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }
    console.error('[payments/activate]', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 });
  }
}
