/**
 * POST /api/payments/checkout — create Party Pass Stripe Checkout (PRD-09).
 * Price / user / duration are server-determined; client fields are ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getIpHash } from '@/lib/support/withApiLogging';
import {
  enforceAuthRateLimit,
  genericAuthRateLimitResponse,
  hashLimiterId,
} from '@/lib/auth/auth-rate-limit';
import {
  CheckoutConflictError,
  CheckoutDisabledError,
  createPartyPassCheckoutSession,
} from '@/lib/payments/checkout';
import { PaymentsConfigError } from '@/lib/payments/config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    const userId = auth.user.user_id;

    const ipHash = hashLimiterId('ip', getIpHash(req));
    const accountHash = hashLimiterId('user', userId);
    const limit = await enforceAuthRateLimit({
      action: 'party_pass_checkout',
      ipHash,
      accountHash,
      maxPerIp: 20,
      maxPerAccount: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(genericAuthRateLimitResponse(limit.retryAfterSec), {
        status: 429,
        headers: limit.retryAfterSec
          ? { 'Retry-After': String(limit.retryAfterSec) }
          : undefined,
      });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    // Intentionally ignore client-supplied commercial fields
    const result = await createPartyPassCheckoutSession({
      userId,
      email: auth.user.email,
      clientPricePence: body.pricePence ?? body.amount ?? body.price,
      clientUserId: body.userId,
      clientDurationDays: body.durationDays ?? body.days,
    });

    return NextResponse.json({
      url: result.url,
      sessionId: result.sessionId,
      purchaseId: result.purchaseId,
      amountPence: result.amountPence,
      currency: result.currency,
      product: 'party_pass',
      ...(result.mock ? { mock: true } : {}),
    });
  } catch (error) {
    if (error instanceof CheckoutDisabledError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'CHECKOUT_DISABLED',
        },
        { status: 403 }
      );
    }
    if (error instanceof CheckoutConflictError) {
      return NextResponse.json(
        { error: error.message, code: 'CHECKOUT_CONFLICT' },
        { status: 409 }
      );
    }
    if (error instanceof PaymentsConfigError) {
      return NextResponse.json(
        { error: 'Payments are not configured', code: 'PAYMENTS_CONFIG' },
        { status: 503 }
      );
    }
    console.error('[payments/checkout]', error instanceof Error ? error.message : 'error');
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
