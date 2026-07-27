/**
 * PRD-09 payment security negatives (unit-level, no live Stripe).
 */

import {
  assertStripeTestModeSecret,
  isPartyPassCheckoutEnabled,
  PaymentsConfigError,
} from '@/lib/payments/config';
import {
  constructStripeEvent,
  WebhookSignatureError,
} from '@/lib/payments/webhook';
import { resetStripeClientForTests } from '@/lib/payments/stripe-client';

describe('PRD-09 security: Stripe test-mode enforcement', () => {
  const prev = {
    enabled: process.env.PARTY_PASS_CHECKOUT_ENABLED,
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_WEBHOOK_SECRET,
    app: process.env.NEXT_PUBLIC_APP_URL,
  };

  afterEach(() => {
    resetStripeClientForTests();
    for (const [key, value] of Object.entries({
      PARTY_PASS_CHECKOUT_ENABLED: prev.enabled,
      STRIPE_SECRET_KEY: prev.secret,
      STRIPE_WEBHOOK_SECRET: prev.webhook,
      NEXT_PUBLIC_APP_URL: prev.app,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('forged webhook signature is rejected', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_security_fixture';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_security_fixture';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    resetStripeClientForTests();

    expect(() =>
      constructStripeEvent('{"id":"evt_forged"}', 't=1,v1=deadbeef')
    ).toThrow(WebhookSignatureError);
  });

  it('missing stripe-signature header is rejected', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_security_fixture';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_security_fixture';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    resetStripeClientForTests();

    expect(() => constructStripeEvent('{}', null)).toThrow(WebhookSignatureError);
  });

  it('live secret key cannot enable checkout', () => {
    process.env.PARTY_PASS_CHECKOUT_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_live_should_never_enable';
    expect(isPartyPassCheckoutEnabled()).toBe(false);
    expect(() => assertStripeTestModeSecret('sk_live_should_never_enable')).toThrow(
      PaymentsConfigError
    );
  });
});
