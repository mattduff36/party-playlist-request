/**
 * PRD-09: Party Pass payments + entitlements — unit / security coverage.
 */

import fs from 'fs';
import path from 'path';
import {
  PARTY_PASS_AMOUNT_PENCE,
  PARTY_PASS_ACTIVE_DAYS,
  PARTY_PASS_CURRENCY,
  assertStripeTestModeSecret,
  buildCheckoutRedirectUrls,
  isDummyStripeSecretKey,
  isPartyPassCheckoutEnabled,
  isPartyPassStripeMockActive,
  partyPassAmountPence,
  PaymentsConfigError,
} from '@/lib/payments/config';
import {
  computeExpiresAt,
  computeUseByAt,
} from '@/lib/payments/entitlement';
import { CANONICAL_MIGRATIONS } from '@/lib/db/migrate/registry';
import {
  assertPartyPassCheckoutPayment,
  CheckoutPaymentMismatchError,
  WebhookSignatureError,
  constructStripeEvent,
} from '@/lib/payments/webhook';
import { resetStripeClientForTests } from '@/lib/payments/stripe-client';

const ROOT = path.resolve(__dirname, '../..');

describe('PRD-09: catalogue price is server-controlled', () => {
  const prevAmount = process.env.PARTY_PASS_AMOUNT_PENCE;

  afterEach(() => {
    if (prevAmount === undefined) delete process.env.PARTY_PASS_AMOUNT_PENCE;
    else process.env.PARTY_PASS_AMOUNT_PENCE = prevAmount;
  });

  it('defaults to £19.99 GBP (1999 pence)', () => {
    delete process.env.PARTY_PASS_AMOUNT_PENCE;
    expect(PARTY_PASS_AMOUNT_PENCE).toBe(1999);
    expect(partyPassAmountPence()).toBe(1999);
    expect(PARTY_PASS_CURRENCY).toBe('gbp');
    expect(PARTY_PASS_ACTIVE_DAYS).toBe(30);
  });

  it('ignores invalid amount overrides', () => {
    process.env.PARTY_PASS_AMOUNT_PENCE = '-5';
    expect(partyPassAmountPence()).toBe(1999);
  });
});

describe('PRD-09: feature flag / production disable', () => {
  const prev = {
    enabled: process.env.PARTY_PASS_CHECKOUT_ENABLED,
    secret: process.env.STRIPE_SECRET_KEY,
    mock: process.env.PARTY_PASS_STRIPE_MOCK,
    vercelEnv: process.env.VERCEL_ENV,
  };

  afterEach(() => {
    if (prev.enabled === undefined) delete process.env.PARTY_PASS_CHECKOUT_ENABLED;
    else process.env.PARTY_PASS_CHECKOUT_ENABLED = prev.enabled;
    if (prev.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prev.secret;
    if (prev.mock === undefined) delete process.env.PARTY_PASS_STRIPE_MOCK;
    else process.env.PARTY_PASS_STRIPE_MOCK = prev.mock;
    if (prev.vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev.vercelEnv;
  });

  it('disables checkout when flag unset', () => {
    delete process.env.PARTY_PASS_CHECKOUT_ENABLED;
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    expect(isPartyPassCheckoutEnabled()).toBe(false);
  });

  it('disables checkout for live secret keys even when flag on', () => {
    process.env.PARTY_PASS_CHECKOUT_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_live_dummy';
    expect(isPartyPassCheckoutEnabled()).toBe(false);
  });

  it('enables only with flag + sk_test_', () => {
    process.env.PARTY_PASS_CHECKOUT_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    expect(isPartyPassCheckoutEnabled()).toBe(true);
  });

  it('refuses live keys in assertStripeTestModeSecret', () => {
    expect(() => assertStripeTestModeSecret('sk_live_x')).toThrow(
      PaymentsConfigError
    );
  });

  it('detects dummy sk_test placeholders', () => {
    expect(isDummyStripeSecretKey('sk_test_dummy')).toBe(true);
    expect(isDummyStripeSecretKey('sk_test_placeholder_preview')).toBe(true);
    expect(
      isDummyStripeSecretKey(
        'sk_test_' + 'a'.repeat(80)
      )
    ).toBe(false);
  });

  it('activates Stripe mock only with explicit flag + dummy key', () => {
    delete process.env.VERCEL_ENV;
    process.env.PARTY_PASS_STRIPE_MOCK = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    expect(isPartyPassStripeMockActive()).toBe(true);
  });

  it('never activates Stripe mock on Vercel production', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.PARTY_PASS_STRIPE_MOCK = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    expect(isPartyPassStripeMockActive()).toBe(false);
  });

  it('never activates Stripe mock with live keys', () => {
    delete process.env.VERCEL_ENV;
    process.env.PARTY_PASS_STRIPE_MOCK = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_live_dummy';
    expect(isPartyPassStripeMockActive()).toBe(false);
  });

  it('keeps real Stripe path when real sk_test_* present even if mock flag set', () => {
    delete process.env.VERCEL_ENV;
    process.env.PARTY_PASS_STRIPE_MOCK = '1';
    process.env.PARTY_PASS_CHECKOUT_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_test_' + 'b'.repeat(80);
    expect(isPartyPassStripeMockActive()).toBe(false);
    expect(isPartyPassCheckoutEnabled()).toBe(true);
  });
});

describe('PRD-09: activation window math', () => {
  it('use-by is purchased_at + 365 days by default', () => {
    const purchased = new Date('2026-01-01T12:00:00.000Z');
    const useBy = computeUseByAt(purchased);
    expect(useBy.toISOString()).toBe('2027-01-01T12:00:00.000Z');
  });

  it('expires_at is starts_at + exactly 30 days', () => {
    const starts = new Date('2026-07-26T10:00:00.000Z');
    const expires = computeExpiresAt(starts);
    expect(expires.toISOString()).toBe('2026-08-25T10:00:00.000Z');
  });
});

describe('PRD-09: redirect allowlist', () => {
  it('builds success/cancel URLs under app base only', () => {
    const urls = buildCheckoutRedirectUrls('https://example.com');
    expect(urls.successUrl).toContain(
      'https://example.com/account/party-pass?checkout=success'
    );
    expect(urls.successUrl).toContain('session_id={CHECKOUT_SESSION_ID}');
    expect(urls.cancelUrl).toBe(
      'https://example.com/account/party-pass?checkout=cancelled'
    );
  });
});

describe('PRD-09: migration Class B registered', () => {
  it('registers 011_prd09_party_pass_payments as Class B', () => {
    const mig = CANONICAL_MIGRATIONS.find(
      (m) => m.id === '011_prd09_party_pass_payments'
    );
    expect(mig).toBeDefined();
    expect(mig?.classification).toBe('B');
    const sqlPath = path.join(
      ROOT,
      'src/lib/db/migrations/canonical',
      mig!.file
    );
    expect(fs.existsSync(sqlPath)).toBe(true);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('party_pass_purchases');
    expect(sql).toContain('party_pass_entitlements');
    expect(sql).toContain('stripe_webhook_events');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});

describe('PRD-09: webhook signature rejection', () => {
  const prev = {
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_WEBHOOK_SECRET,
    app: process.env.NEXT_PUBLIC_APP_URL,
  };

  afterEach(() => {
    resetStripeClientForTests();
    if (prev.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prev.secret;
    if (prev.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prev.webhook;
    if (prev.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev.app;
  });

  it('exports WebhookSignatureError for forged payloads', () => {
    const err = new WebhookSignatureError();
    expect(err.name).toBe('WebhookSignatureError');
  });

  it('requires stripe-signature header before processing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_fixture';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    resetStripeClientForTests();

    expect(() => constructStripeEvent('{}', null)).toThrow(WebhookSignatureError);
  });
});

describe('PRD-09: checkout completed amount/currency gate', () => {
  const prevAmount = process.env.PARTY_PASS_AMOUNT_PENCE;

  afterEach(() => {
    if (prevAmount === undefined) delete process.env.PARTY_PASS_AMOUNT_PENCE;
    else process.env.PARTY_PASS_AMOUNT_PENCE = prevAmount;
  });

  it('accepts paid GBP at catalogue amount', () => {
    delete process.env.PARTY_PASS_AMOUNT_PENCE;
    expect(() =>
      assertPartyPassCheckoutPayment({
        id: 'cs_test_ok',
        payment_status: 'paid',
        currency: 'gbp',
        amount_total: 1999,
      })
    ).not.toThrow();
  });

  it('accepts amount matching stored purchase when catalogue differs', () => {
    process.env.PARTY_PASS_AMOUNT_PENCE = '1999';
    expect(() =>
      assertPartyPassCheckoutPayment(
        {
          id: 'cs_test_stored',
          payment_status: 'paid',
          currency: 'gbp',
          amount_total: 1500,
        },
        { storedAmountPence: 1500 }
      )
    ).not.toThrow();
  });

  it('rejects amount mismatches', () => {
    delete process.env.PARTY_PASS_AMOUNT_PENCE;
    expect(() =>
      assertPartyPassCheckoutPayment({
        id: 'cs_test_bad_amount',
        payment_status: 'paid',
        currency: 'gbp',
        amount_total: 1,
      })
    ).toThrow(CheckoutPaymentMismatchError);
  });

  it('rejects non-gbp currency', () => {
    expect(() =>
      assertPartyPassCheckoutPayment({
        id: 'cs_test_usd',
        payment_status: 'paid',
        currency: 'usd',
        amount_total: 1999,
      })
    ).toThrow(/currency_mismatch/);
  });

  it('rejects no_payment_required for Party Pass', () => {
    expect(() =>
      assertPartyPassCheckoutPayment({
        id: 'cs_test_free',
        payment_status: 'no_payment_required',
        currency: 'gbp',
        amount_total: 0,
      })
    ).toThrow(/no_payment_required_rejected/);
  });
});

describe('PRD-09: checkout route ignores client price (source contract)', () => {
  it('checkout route documents ignore of client commercial fields', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/app/api/payments/checkout/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/Intentionally ignore client-supplied commercial fields/);
    expect(src).toMatch(/clientPricePence/);
  });

  it('activate route requires confirm and ignores client duration', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/app/api/payments/activate/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/confirm !== true/);
    expect(src).toMatch(/Ignore client-supplied starts\/expires\/duration/);
  });

  it('event status uses unified paid entitlement gate', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/app/api/event/status/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/assertCanActivatePaidEvent/);
    expect(src).toMatch(/PARTY_PASS_ACTIVATION_REQUIRED/);
  });
});
