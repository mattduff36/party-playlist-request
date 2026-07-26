/**
 * PRD-09: webhook ledger idempotency + amount mismatch rejection (mocked DB).
 */

const clientQuery = jest.fn();
const poolQuery = jest.fn();
const release = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => poolQuery(...args),
    connect: async () => ({
      query: (...args: unknown[]) => clientQuery(...args),
      release,
    }),
  }),
}));

import type Stripe from 'stripe';
import { processStripeWebhookEvent } from '@/lib/payments/webhook';

function baseCheckoutEvent(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Event {
  const session = {
    id: 'cs_test_session_1',
    object: 'checkout.session',
    payment_status: 'paid',
    currency: 'gbp',
    amount_total: 1999,
    customer: 'cus_test_1',
    payment_intent: 'pi_test_1',
    metadata: {
      partyplaylist_user_id: 'user-1',
      partyplaylist_purchase_id: 'purchase-1',
      product_code: 'party_pass',
    },
    ...overrides,
  } as Stripe.Checkout.Session;

  return {
    id: 'evt_test_unique_1',
    object: 'event',
    api_version: '2024-06-20',
    created: 1,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'checkout.session.completed',
    data: { object: session },
  } as Stripe.Event;
}

describe('PRD-09: webhook processStripeWebhookEvent', () => {
  beforeEach(() => {
    clientQuery.mockReset();
    poolQuery.mockReset();
    release.mockReset();
  });

  it('duplicate stripe_event_id is an idempotent no-op', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // claim (conflict, already processed)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const result = await processStripeWebhookEvent(baseCheckoutEvent());

    expect(result).toEqual({
      duplicate: true,
      handled: false,
      eventType: 'checkout.session.completed',
      stripeEventId: 'evt_test_unique_1',
    });
    expect(release).toHaveBeenCalled();
    // No entitlement / purchase writes after duplicate claim
    const sqlJoined = clientQuery.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sqlJoined).not.toMatch(/party_pass_entitlements/);
    expect(sqlJoined).not.toMatch(/payment_status = 'paid'/);
  });

  it('amount mismatch is rejected without entitlement', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // claim
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'purchase-1',
            user_id: 'user-1',
            amount_pence: 1999,
            stripe_checkout_session_id: 'cs_test_session_1',
          },
        ],
        rowCount: 1,
      }) // resolve purchase
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // mark ignored
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const result = await processStripeWebhookEvent(
      baseCheckoutEvent({ amount_total: 50 })
    );

    expect(result.duplicate).toBe(false);
    expect(result.handled).toBe(false);
    expect(result.rejected).toBe(true);

    const sqlJoined = clientQuery.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sqlJoined).toMatch(/processing_status = 'ignored'/);
    expect(sqlJoined).not.toMatch(/INSERT INTO party_pass_entitlements/);
    expect(sqlJoined).not.toMatch(/SET payment_status = 'paid'/);
  });
});
