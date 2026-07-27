/**
 * Stripe webhook verification + idempotent processing (PRD-09).
 */

import type Stripe from 'stripe';
import { getPool } from '@/lib/db';
import {
  getPartyPassStripeConfig,
  PARTY_PASS_CURRENCY,
  PARTY_PASS_PRODUCT_CODE,
  PARTY_PASS_USE_BY_DAYS,
  partyPassAmountPence,
} from '@/lib/payments/config';
import { getStripeClient, redactStripeId } from '@/lib/payments/stripe-client';
import { computeUseByAt } from '@/lib/payments/entitlement';
export class WebhookSignatureError extends Error {
  constructor(message = 'Invalid Stripe webhook signature') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/** Permanent checkout commercial mismatch — do not grant entitlement; do not Stripe-retry. */
export class CheckoutPaymentMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutPaymentMismatchError';
  }
}

export interface WebhookProcessResult {
  duplicate: boolean;
  handled: boolean;
  eventType: string;
  stripeEventId: string;
  rejected?: boolean;
}

/**
 * Require paid GBP Party Pass amount before entitlement.
 * Rejects `no_payment_required` (Party Pass is a paid product).
 * amount_total must equal catalogue price or the stored purchase amount.
 */
export function assertPartyPassCheckoutPayment(
  session: Pick<
    Stripe.Checkout.Session,
    'payment_status' | 'currency' | 'amount_total' | 'id'
  >,
  options?: {
    expectedAmountPence?: number;
    storedAmountPence?: number | null;
  }
): void {
  if (session.payment_status === 'no_payment_required') {
    throw new CheckoutPaymentMismatchError('no_payment_required_rejected');
  }
  if (session.payment_status !== 'paid') {
    throw new CheckoutPaymentMismatchError(
      `payment_status_rejected:${session.payment_status ?? 'unknown'}`
    );
  }

  const currency = (session.currency ?? '').toLowerCase();
  if (currency !== PARTY_PASS_CURRENCY) {
    throw new CheckoutPaymentMismatchError(
      `currency_mismatch:${currency || 'missing'}`
    );
  }

  if (typeof session.amount_total !== 'number') {
    throw new CheckoutPaymentMismatchError('amount_total_missing');
  }

  const catalogue = options?.expectedAmountPence ?? partyPassAmountPence();
  const allowed = new Set<number>([catalogue]);
  const stored = options?.storedAmountPence;
  if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) {
    allowed.add(stored);
  }

  if (!allowed.has(session.amount_total)) {
    throw new CheckoutPaymentMismatchError(
      `amount_mismatch:${session.amount_total}`
    );
  }
}

export function constructStripeEvent(
  rawBody: string | Buffer,
  signatureHeader: string | null
): Stripe.Event {
  if (!signatureHeader) {
    throw new WebhookSignatureError('Missing stripe-signature header');
  }
  const config = getPartyPassStripeConfig();
  const stripe = getStripeClient();
  try {
    return stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      config.webhookSecret
    );
  } catch {
    throw new WebhookSignatureError();
  }
}

function summarizeEvent(event: Stripe.Event): Record<string, unknown> {
  const obj = event.data.object as { id?: string };
  return {
    type: event.type,
    object_id: redactStripeId(obj?.id),
    livemode: event.livemode,
  };
}

/**
 * Insert ledger row first (unique stripe_event_id). Duplicate → no-op.
 * Then apply effects in the same connection/transaction where practical.
 */
export async function processStripeWebhookEvent(
  event: Stripe.Event
): Promise<WebhookProcessResult> {
  // Refuse live-mode events in this test-mode-only build
  if (event.livemode) {
    const pool = getPool();
    await pool.query(
      `INSERT INTO stripe_webhook_events
         (stripe_event_id, event_type, livemode, processing_status, payload_summary, processed_at, error_message)
       VALUES ($1, $2, true, 'ignored', $3::jsonb, NOW(), 'livemode_rejected')
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(summarizeEvent(event))]
    );
    return {
      duplicate: false,
      handled: false,
      eventType: event.type,
      stripeEventId: event.id,
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Claim the event: new rows, or prior failures eligible for Stripe retry.
    const claimed = await client.query(
      `INSERT INTO stripe_webhook_events
         (stripe_event_id, event_type, livemode, processing_status, payload_summary)
       VALUES ($1, $2, $3, 'processed', $4::jsonb)
       ON CONFLICT (stripe_event_id) DO UPDATE
         SET processing_status = 'processed',
             error_message = NULL,
             payload_summary = EXCLUDED.payload_summary
       WHERE stripe_webhook_events.processing_status = 'failed'
       RETURNING id`,
      [
        event.id,
        event.type,
        event.livemode,
        JSON.stringify(summarizeEvent(event)),
      ]
    );

    if (!claimed.rows[0]) {
      await client.query('COMMIT');
      return {
        duplicate: true,
        handled: false,
        eventType: event.type,
        stripeEventId: event.id,
      };
    }

    try {
      await applyStripeEventEffects(client, event);
      await client.query(
        `UPDATE stripe_webhook_events
         SET processed_at = NOW(), processing_status = 'processed', error_message = NULL
         WHERE stripe_event_id = $1`,
        [event.id]
      );
      await client.query('COMMIT');
    } catch (error) {
      if (error instanceof CheckoutPaymentMismatchError) {
        // Permanent commercial reject — acknowledge to Stripe; no entitlement.
        await client.query(
          `UPDATE stripe_webhook_events
           SET processed_at = NOW(),
               processing_status = 'ignored',
               error_message = $2
           WHERE stripe_event_id = $1`,
          [event.id, error.message.slice(0, 500)]
        );
        await client.query('COMMIT');
        alertWebhookFailure('checkout_payment_mismatch', {
          event: event.id,
          reason: error.message.slice(0, 200),
        });
        return {
          duplicate: false,
          handled: false,
          rejected: true,
          eventType: event.type,
          stripeEventId: event.id,
        };
      }

      await client.query('ROLLBACK');
      // Mark failed outside the rolled-back txn so Stripe can retry
      await pool.query(
        `INSERT INTO stripe_webhook_events
           (stripe_event_id, event_type, livemode, processing_status, payload_summary, error_message, processed_at)
         VALUES ($1, $2, $3, 'failed', $4::jsonb, $5, NOW())
         ON CONFLICT (stripe_event_id) DO UPDATE
           SET processing_status = 'failed',
               error_message = EXCLUDED.error_message,
               processed_at = NOW()`,
        [
          event.id,
          event.type,
          event.livemode,
          JSON.stringify(summarizeEvent(event)),
          error instanceof Error ? error.message.slice(0, 500) : 'unknown',
        ]
      );
      throw error;
    }

    return {
      duplicate: false,
      handled: true,
      eventType: event.type,
      stripeEventId: event.id,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

type DbClient = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
};

async function applyStripeEventEffects(
  client: DbClient,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await handleCheckoutCompleted(
        client,
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case 'checkout.session.expired':
      await handleCheckoutExpired(
        client,
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case 'charge.refunded':
      await handleChargeRefunded(client, event.data.object as Stripe.Charge);
      break;
    case 'charge.dispute.created':
    case 'charge.dispute.updated':
      await handleDispute(client, event.data.object as Stripe.Dispute);
      break;
    default:
      // Acknowledge unhandled types without failing (ledger already recorded)
      break;
  }
}

async function resolvePurchaseForSession(
  client: DbClient,
  session: Stripe.Checkout.Session
): Promise<Record<string, unknown> | null> {
  const purchaseId = session.metadata?.partyplaylist_purchase_id;
  if (purchaseId) {
    const byId = await client.query(
      `SELECT * FROM party_pass_purchases WHERE id = $1 LIMIT 1`,
      [purchaseId]
    );
    if (byId.rows[0]) return byId.rows[0];
  }

  if (session.id) {
    const bySession = await client.query(
      `SELECT * FROM party_pass_purchases
       WHERE stripe_checkout_session_id = $1
       LIMIT 1`,
      [session.id]
    );
    if (bySession.rows[0]) return bySession.rows[0];
  }

  return null;
}

async function handleCheckoutCompleted(
  client: DbClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  // Unpaid / incomplete sessions: ignore (Stripe may send later success events).
  if (
    session.payment_status !== 'paid' &&
    session.payment_status !== 'no_payment_required'
  ) {
    return;
  }

  const purchase = await resolvePurchaseForSession(client, session);
  if (!purchase) {
    // Reconcile from Stripe identifiers — create if metadata has user + we trust session
    const userId = session.metadata?.partyplaylist_user_id;
    if (!userId || session.metadata?.product_code !== PARTY_PASS_PRODUCT_CODE) {
      return;
    }
  }

  const storedAmountRaw = purchase?.amount_pence;
  const storedAmountPence =
    typeof storedAmountRaw === 'number'
      ? storedAmountRaw
      : storedAmountRaw != null
        ? Number(storedAmountRaw)
        : null;

  // Commercial gate before any paid / entitlement write
  assertPartyPassCheckoutPayment(session, {
    expectedAmountPence: partyPassAmountPence(),
    storedAmountPence:
      storedAmountPence != null && Number.isFinite(storedAmountPence)
        ? storedAmountPence
        : null,
  });

  const storedSessionId = purchase?.stripe_checkout_session_id
    ? String(purchase.stripe_checkout_session_id)
    : null;
  if (storedSessionId && storedSessionId !== session.id) {
    throw new CheckoutPaymentMismatchError('checkout_session_mismatch');
  }

  const userId =
    (purchase?.user_id as string | undefined) ||
    session.metadata?.partyplaylist_user_id;
  if (!userId) return;

  let purchaseId = purchase?.id ? String(purchase.id) : null;
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const amountPence =
    typeof session.amount_total === 'number'
      ? session.amount_total
      : partyPassAmountPence();

  if (!purchaseId) {
    const inserted = await client.query(
      `INSERT INTO party_pass_purchases
         (user_id, stripe_customer_id, stripe_checkout_session_id, stripe_payment_intent_id,
          currency, amount_pence, payment_status, product_code, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, NOW())
       ON CONFLICT (stripe_checkout_session_id) DO UPDATE
         SET payment_status = 'paid',
             stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, party_pass_purchases.stripe_payment_intent_id),
             paid_at = COALESCE(party_pass_purchases.paid_at, NOW()),
             updated_at = NOW()
       RETURNING id`,
      [
        userId,
        typeof session.customer === 'string' ? session.customer : null,
        session.id,
        paymentIntentId,
        PARTY_PASS_CURRENCY,
        amountPence,
        PARTY_PASS_PRODUCT_CODE,
      ]
    );
    purchaseId = String(inserted.rows[0].id);
  } else {
    await client.query(
      `UPDATE party_pass_purchases
       SET payment_status = 'paid',
           stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $4),
           stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
           stripe_customer_id = COALESCE($3, stripe_customer_id),
           paid_at = COALESCE(paid_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [
        purchaseId,
        paymentIntentId,
        typeof session.customer === 'string' ? session.customer : null,
        session.id,
      ]
    );
  }

  // Create entitlement as purchased (NOT activated)
  const purchasedAt = new Date();
  const useBy = computeUseByAt(purchasedAt, PARTY_PASS_USE_BY_DAYS);

  await client.query(
    `INSERT INTO party_pass_entitlements
       (purchase_id, user_id, status, purchased_at, use_by_at, source)
     VALUES ($1, $2, 'purchased', $3, $4, 'stripe_checkout')
     ON CONFLICT (purchase_id) DO NOTHING`,
    [purchaseId, userId, purchasedAt.toISOString(), useBy.toISOString()]
  );

  // Audit / funnel outside critical path — still best-effort inside txn via same client
  await client.query(
    `INSERT INTO party_pass_audit
       (user_id, purchase_id, action, meta)
     VALUES ($1, $2, 'purchase_paid', $3::jsonb)`,
    [
      userId,
      purchaseId,
      JSON.stringify({
        session: redactStripeId(session.id),
        amount_pence: amountPence,
      }),
    ]
  );
  await client.query(
    `INSERT INTO party_pass_funnel_events (user_id, event_name, meta)
     VALUES ($1, 'purchase_completed', $2::jsonb)`,
    [userId, JSON.stringify({ purchase_id: purchaseId })]
  );
}

async function handleCheckoutExpired(
  client: DbClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  await client.query(
    `UPDATE party_pass_purchases
     SET payment_status = 'cancelled', updated_at = NOW()
     WHERE stripe_checkout_session_id = $1
       AND payment_status = 'pending'`,
    [session.id]
  );
}

async function handleChargeRefunded(
  client: DbClient,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const purchase = await client.query(
    `SELECT * FROM party_pass_purchases
     WHERE stripe_payment_intent_id = $1
     LIMIT 1`,
    [paymentIntentId]
  );
  if (!purchase.rows[0]) return;

  const purchaseId = String(purchase.rows[0].id);
  const userId = String(purchase.rows[0].user_id);
  const fullyRefunded =
    typeof charge.amount_refunded === 'number' &&
    typeof charge.amount === 'number' &&
    charge.amount_refunded >= charge.amount;

  await client.query(
    `UPDATE party_pass_purchases
     SET payment_status = $2,
         refund_status = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [
      purchaseId,
      fullyRefunded ? 'refunded' : 'partially_refunded',
      fullyRefunded ? 'full' : 'partial',
    ]
  );

  // Policy: refund revokes / marks entitlement so live activation fails
  await client.query(
    `UPDATE party_pass_entitlements
     SET status = 'refunded', updated_at = NOW()
     WHERE purchase_id = $1
       AND status IN ('purchased', 'activated')`,
    [purchaseId]
  );

  await client.query(
    `INSERT INTO party_pass_audit
       (user_id, purchase_id, action, meta)
     VALUES ($1, $2, 'refund_recorded', $3::jsonb)`,
    [
      userId,
      purchaseId,
      JSON.stringify({
        fully_refunded: fullyRefunded,
        charge: redactStripeId(charge.id),
      }),
    ]
  );
  await client.query(
    `INSERT INTO party_pass_funnel_events (user_id, event_name, meta)
     VALUES ($1, 'refund_completed', $2::jsonb)`,
    [userId, JSON.stringify({ purchase_id: purchaseId })]
  );
}

async function handleDispute(
  client: DbClient,
  dispute: Stripe.Dispute
): Promise<void> {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!paymentIntentId) return;

  const purchase = await client.query(
    `SELECT * FROM party_pass_purchases
     WHERE stripe_payment_intent_id = $1
     LIMIT 1`,
    [paymentIntentId]
  );
  if (!purchase.rows[0]) return;

  const purchaseId = String(purchase.rows[0].id);
  const userId = String(purchase.rows[0].user_id);

  await client.query(
    `UPDATE party_pass_purchases
     SET payment_status = 'disputed',
         dispute_status = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [purchaseId, dispute.status || 'needs_response']
  );

  await client.query(
    `UPDATE party_pass_entitlements
     SET status = 'disputed', updated_at = NOW()
     WHERE purchase_id = $1
       AND status IN ('purchased', 'activated')`,
    [purchaseId]
  );

  await client.query(
    `INSERT INTO party_pass_audit
       (user_id, purchase_id, action, meta)
     VALUES ($1, $2, 'dispute_recorded', $3::jsonb)`,
    [
      userId,
      purchaseId,
      JSON.stringify({
        dispute: redactStripeId(dispute.id),
        status: dispute.status || null,
      }),
    ]
  );
}

/** Alerting hook for signature / repeated failures (stdout structured). */
export function alertWebhookFailure(kind: string, meta?: Record<string, unknown>): void {
  console.error(
    '[party-pass-webhook-alert]',
    JSON.stringify({
      kind,
      at: new Date().toISOString(),
      meta: meta ?? {},
    })
  );
}
