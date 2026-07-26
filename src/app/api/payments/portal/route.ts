/**
 * POST /api/payments/portal — Stripe Customer Portal (receipts/invoices) PRD-09.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getPool } from '@/lib/db';
import {
  getAppBaseUrl,
  isPartyPassCheckoutEnabled,
  PaymentsConfigError,
} from '@/lib/payments/config';
import { getStripeClient } from '@/lib/payments/stripe-client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.user) return auth.response!;
    if (!isPartyPassCheckoutEnabled()) {
      return NextResponse.json(
        { error: 'Billing portal unavailable', code: 'CHECKOUT_DISABLED' },
        { status: 403 }
      );
    }

    const pool = getPool();
    const row = await pool.query(
      `SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1`,
      [auth.user.user_id]
    );
    const customerId = row.rows[0]?.stripe_customer_id as string | undefined;
    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing customer on file', code: 'NO_CUSTOMER' },
        { status: 404 }
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppBaseUrl()}/account/party-pass`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof PaymentsConfigError) {
      return NextResponse.json(
        { error: 'Payments are not configured', code: 'PAYMENTS_CONFIG' },
        { status: 503 }
      );
    }
    console.error('[payments/portal]', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Failed to open portal' }, { status: 500 });
  }
}
