/**
 * GET /api/payments/status — Party Pass account / purchase status (PRD-09).
 * Optional ?session_id= verifies Checkout success without granting access from QS alone.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPartyPassAccountSummary } from '@/lib/payments/entitlement';
import { getVerifiedPurchaseForSession } from '@/lib/payments/checkout';
import {
  isPartyPassCheckoutEnabled,
  PARTY_PASS_ACTIVE_DAYS,
  PARTY_PASS_AMOUNT_PENCE,
  PARTY_PASS_CURRENCY,
  PARTY_PASS_DISPLAY_NAME,
  partyPassAmountPence,
} from '@/lib/payments/config';
import { recordFunnelEvent } from '@/lib/payments/audit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const userId = auth.user.user_id;
    const sessionId = req.nextUrl.searchParams.get('session_id');
    const viewed = req.nextUrl.searchParams.get('view');

    if (viewed === 'pricing') {
      await recordFunnelEvent({
        eventName: 'pricing_viewed',
        userId,
      }).catch(() => undefined);
    }

    const summary = await getPartyPassAccountSummary(userId);

    let sessionVerification: Awaited<
      ReturnType<typeof getVerifiedPurchaseForSession>
    > | null = null;

    if (sessionId) {
      try {
        sessionVerification = await getVerifiedPurchaseForSession({
          userId,
          checkoutSessionId: sessionId,
        });
      } catch {
        sessionVerification = {
          verified: false,
          paymentStatus: null,
          purchaseId: null,
          activated: false,
        };
      }
    }

    return NextResponse.json({
      product: {
        code: 'party_pass',
        name: PARTY_PASS_DISPLAY_NAME,
        amountPence: partyPassAmountPence() || PARTY_PASS_AMOUNT_PENCE,
        currency: PARTY_PASS_CURRENCY,
        activeDays: PARTY_PASS_ACTIVE_DAYS,
      },
      checkoutEnabled: isPartyPassCheckoutEnabled(),
      canStartEvent: summary.canStartEvent,
      reason: summary.reason,
      betaActive: summary.betaActive,
      active: summary.active,
      unactivated: summary.unactivated,
      history: summary.history,
      sessionVerification,
      note:
        'A success query string never grants access. Entitlement comes from verified payment + optional activation.',
    });
  } catch (error) {
    console.error('[payments/status]', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Failed to load status' }, { status: 500 });
  }
}
