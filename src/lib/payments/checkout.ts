/**
 * Server-side Stripe Checkout for Party Pass (PRD-09).
 * Price / product / user are determined server-side only.
 */

import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
import { getPool } from '@/lib/db';
import {
  buildCheckoutRedirectUrls,
  getAppBaseUrl,
  getPartyPassStripeConfig,
  isPartyPassCheckoutEnabled,
  isPartyPassStripeMockActive,
  PARTY_PASS_CURRENCY,
  PARTY_PASS_DISPLAY_NAME,
  PARTY_PASS_PRODUCT_CODE,
  partyPassAmountPence,
  PaymentsConfigError,
} from '@/lib/payments/config';
import { getStripeClient, redactStripeId } from '@/lib/payments/stripe-client';
import { recordFunnelEvent, recordPartyPassAudit } from '@/lib/payments/audit';
import { processStripeWebhookEvent } from '@/lib/payments/webhook';

export class CheckoutDisabledError extends Error {
  constructor(message = 'Party Pass checkout is disabled') {
    super(message);
    this.name = 'CheckoutDisabledError';
  }
}

export class CheckoutConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutConflictError';
  }
}

async function getOrCreateStripeCustomer(userId: string, email?: string | null): Promise<string> {
  const pool = getPool();
  const existing = await pool.query(
    `SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1`,
    [userId]
  );
  if (existing.rows[0]?.stripe_customer_id) {
    return String(existing.rows[0].stripe_customer_id);
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: {
      partyplaylist_user_id: userId,
      product: PARTY_PASS_PRODUCT_CODE,
    },
  });

  await pool.query(
    `INSERT INTO stripe_customers (user_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET stripe_customer_id = EXCLUDED.stripe_customer_id,
           updated_at = NOW()`,
    [userId, customer.id]
  );

  return customer.id;
}

/**
 * Preview-only mock checkout: mark payment accepted via the same webhook grant path
 * (no Stripe network). Requires PARTY_PASS_STRIPE_MOCK=1 + dummy sk_test_* and never
 * runs on Vercel Production / live keys.
 */
async function createPartyPassMockCheckoutSession(input: {
  userId: string;
}): Promise<{
  sessionId: string;
  url: string;
  purchaseId: string;
  amountPence: number;
  currency: string;
  mock: true;
}> {
  const amountPence = partyPassAmountPence();
  const pool = getPool();
  const sessionId = `cs_mock_${randomBytes(12).toString('hex')}`;
  const customerId = `cus_mock_${input.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'user'}`;
  const appBaseUrl = getAppBaseUrl();
  const redirects = buildCheckoutRedirectUrls(appBaseUrl);

  const existingOpen = await pool.query(
    `SELECT id FROM party_pass_purchases
     WHERE user_id = $1
       AND payment_status = 'pending'
       AND created_at > NOW() - INTERVAL '2 hours'
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.userId]
  );

  let purchaseId: string;
  if (existingOpen.rows[0]?.id) {
    purchaseId = String(existingOpen.rows[0].id);
    await pool.query(
      `UPDATE party_pass_purchases
       SET stripe_checkout_session_id = $2,
           stripe_customer_id = COALESCE(stripe_customer_id, $3),
           amount_pence = $4,
           currency = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [purchaseId, sessionId, customerId, amountPence, PARTY_PASS_CURRENCY]
    );
  } else {
    const purchaseInsert = await pool.query(
      `INSERT INTO party_pass_purchases
         (user_id, stripe_customer_id, stripe_checkout_session_id, currency, amount_pence,
          payment_status, product_code)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING id`,
      [
        input.userId,
        customerId,
        sessionId,
        PARTY_PASS_CURRENCY,
        amountPence,
        PARTY_PASS_PRODUCT_CODE,
      ]
    );
    purchaseId = String(purchaseInsert.rows[0].id);
  }

  // Partial Session fields only — webhook path reads id/payment_status/amount/etc.
  // Double assertion required: Stripe.Event.Session is a large interface.
  const mockEvent = {
    id: `evt_mock_${randomBytes(12).toString('hex')}`,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        status: 'complete',
        currency: PARTY_PASS_CURRENCY,
        amount_total: amountPence,
        customer: customerId,
        payment_intent: null,
        client_reference_id: input.userId,
        metadata: {
          partyplaylist_user_id: input.userId,
          partyplaylist_purchase_id: purchaseId,
          product_code: PARTY_PASS_PRODUCT_CODE,
        },
      },
    },
  } as unknown as Stripe.Event;

  const result = await processStripeWebhookEvent(mockEvent);
  if (result.rejected || !result.handled) {
    throw new PaymentsConfigError(
      'Preview Stripe mock failed to grant Party Pass entitlement'
    );
  }

  await recordPartyPassAudit({
    action: 'checkout_created',
    userId: input.userId,
    purchaseId,
    actorId: input.userId,
    meta: {
      session: redactStripeId(sessionId),
      amount_pence: amountPence,
      currency: PARTY_PASS_CURRENCY,
      mock: true,
    },
  });
  await recordFunnelEvent({
    eventName: 'checkout_started',
    userId: input.userId,
    meta: { purchase_id: purchaseId, mock: true },
  });

  const successUrl = redirects.successUrl.replace(
    '{CHECKOUT_SESSION_ID}',
    sessionId
  );

  return {
    sessionId,
    url: successUrl,
    purchaseId,
    amountPence,
    currency: PARTY_PASS_CURRENCY,
    mock: true,
  };
}

/**
 * Create a Checkout Session. Ignores any client-supplied price/duration/user fields.
 */
export async function createPartyPassCheckoutSession(input: {
  userId: string;
  email?: string | null;
  /** Ignored — present only to prove we never trust client price. */
  clientPricePence?: unknown;
  clientUserId?: unknown;
  clientDurationDays?: unknown;
}): Promise<{
  sessionId: string;
  url: string;
  purchaseId: string;
  amountPence: number;
  currency: string;
  mock?: boolean;
}> {
  if (!isPartyPassCheckoutEnabled()) {
    throw new CheckoutDisabledError(
      'Party Pass checkout is disabled on this deployment (feature flag / test-mode gate)'
    );
  }

  // Explicitly discard client-trusted commercial fields
  void input.clientPricePence;
  void input.clientUserId;
  void input.clientDurationDays;

  if (isPartyPassStripeMockActive()) {
    return createPartyPassMockCheckoutSession({ userId: input.userId });
  }

  const config = getPartyPassStripeConfig();
  if (!config.checkoutEnabled) {
    throw new CheckoutDisabledError();
  }

  const amountPence = partyPassAmountPence();
  const pool = getPool();

  // Prevent duplicate open checkout sessions where practical
  const open = await pool.query(
    `SELECT id, stripe_checkout_session_id
     FROM party_pass_purchases
     WHERE user_id = $1
       AND payment_status = 'pending'
       AND stripe_checkout_session_id IS NOT NULL
       AND created_at > NOW() - INTERVAL '2 hours'
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.userId]
  );

  if (open.rows[0]?.stripe_checkout_session_id) {
    const stripe = getStripeClient();
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        String(open.rows[0].stripe_checkout_session_id)
      );
      if (existing.status === 'open' && existing.url) {
        return {
          sessionId: existing.id,
          url: existing.url,
          purchaseId: String(open.rows[0].id),
          amountPence,
          currency: PARTY_PASS_CURRENCY,
        };
      }
    } catch {
      // fall through to create a new session
    }
  }

  const customerId = await getOrCreateStripeCustomer(input.userId, input.email);
  const redirects = buildCheckoutRedirectUrls(config.appBaseUrl);
  const stripe = getStripeClient();

  const purchaseInsert = await pool.query(
    `INSERT INTO party_pass_purchases
       (user_id, stripe_customer_id, currency, amount_pence, payment_status, product_code, stripe_price_id)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)
     RETURNING id`,
    [
      input.userId,
      customerId,
      PARTY_PASS_CURRENCY,
      amountPence,
      PARTY_PASS_PRODUCT_CODE,
      config.priceId,
    ]
  );
  const purchaseId = String(purchaseInsert.rows[0].id);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = config.priceId
    ? [{ price: config.priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: PARTY_PASS_CURRENCY,
            unit_amount: amountPence,
            product_data: {
              name: PARTY_PASS_DISPLAY_NAME,
              description:
                'One active event · 30-day window starts when you activate (not at purchase)',
            },
          },
        },
      ];

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: input.userId,
      line_items: lineItems,
      success_url: redirects.successUrl,
      cancel_url: redirects.cancelUrl,
      metadata: {
        partyplaylist_user_id: input.userId,
        partyplaylist_purchase_id: purchaseId,
        product_code: PARTY_PASS_PRODUCT_CODE,
      },
      payment_intent_data: {
        metadata: {
          partyplaylist_user_id: input.userId,
          partyplaylist_purchase_id: purchaseId,
          product_code: PARTY_PASS_PRODUCT_CODE,
        },
      },
    });
  } catch (error) {
    await pool.query(
      `UPDATE party_pass_purchases
       SET payment_status = 'failed', updated_at = NOW()
       WHERE id = $1`,
      [purchaseId]
    );
    throw error;
  }

  if (!session.url) {
    throw new PaymentsConfigError('Stripe Checkout Session missing URL');
  }

  await pool.query(
    `UPDATE party_pass_purchases
     SET stripe_checkout_session_id = $2,
         stripe_payment_intent_id = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [
      purchaseId,
      session.id,
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    ]
  );

  await recordPartyPassAudit({
    action: 'checkout_created',
    userId: input.userId,
    purchaseId,
    actorId: input.userId,
    meta: {
      session: redactStripeId(session.id),
      amount_pence: amountPence,
      currency: PARTY_PASS_CURRENCY,
    },
  });
  await recordFunnelEvent({
    eventName: 'checkout_started',
    userId: input.userId,
    meta: { purchase_id: purchaseId },
  });

  return {
    sessionId: session.id,
    url: session.url,
    purchaseId,
    amountPence,
    currency: PARTY_PASS_CURRENCY,
  };
}

/**
 * Success page helper — never grant entitlement from query string alone.
 * Verifies session against Stripe + local purchase row.
 */
export async function getVerifiedPurchaseForSession(input: {
  userId: string;
  checkoutSessionId: string;
}): Promise<{
  verified: boolean;
  paymentStatus: string | null;
  purchaseId: string | null;
  activated: boolean;
}> {
  const pool = getPool();
  const local = await pool.query(
    `SELECT p.*, e.status AS entitlement_status
     FROM party_pass_purchases p
     LEFT JOIN party_pass_entitlements e ON e.purchase_id = p.id
     WHERE p.user_id = $1
       AND p.stripe_checkout_session_id = $2
     LIMIT 1`,
    [input.userId, input.checkoutSessionId]
  );

  if (!local.rows[0]) {
    return {
      verified: false,
      paymentStatus: null,
      purchaseId: null,
      activated: false,
    };
  }

  const paymentStatus = String(local.rows[0].payment_status);
  const activated =
    String(local.rows[0].entitlement_status || '') === 'activated';

  // Preview mock sessions never hit Stripe — trust local paid row only.
  if (input.checkoutSessionId.startsWith('cs_mock_')) {
    return {
      verified: paymentStatus === 'paid',
      paymentStatus,
      purchaseId: String(local.rows[0].id),
      activated,
    };
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(input.checkoutSessionId);
  const paid =
    session.payment_status === 'paid' &&
    session.metadata?.partyplaylist_user_id === input.userId;

  return {
    verified: paid && paymentStatus === 'paid',
    paymentStatus,
    purchaseId: String(local.rows[0].id),
    activated,
  };
}
