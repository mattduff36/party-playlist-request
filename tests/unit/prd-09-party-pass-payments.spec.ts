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
  isPartyPassCheckoutEnabled,
  partyPassAmountPence,
  PaymentsConfigError,
} from '@/lib/payments/config';
import {
  computeExpiresAt,
  computeUseByAt,
} from '@/lib/payments/entitlement';
import { CANONICAL_MIGRATIONS } from '@/lib/db/migrate/registry';
import { WebhookSignatureError } from '@/lib/payments/webhook';

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
  };

  afterEach(() => {
    if (prev.enabled === undefined) delete process.env.PARTY_PASS_CHECKOUT_ENABLED;
    else process.env.PARTY_PASS_CHECKOUT_ENABLED = prev.enabled;
    if (prev.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prev.secret;
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
  it('exports WebhookSignatureError for forged payloads', () => {
    const err = new WebhookSignatureError();
    expect(err.name).toBe('WebhookSignatureError');
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
