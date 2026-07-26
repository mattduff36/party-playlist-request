/**
 * Party Pass / Stripe server configuration (PRD-09).
 * Price and product identity are server-controlled — never trust the client.
 */

export const PARTY_PASS_PRODUCT_CODE = 'party_pass';
export const PARTY_PASS_DISPLAY_NAME = 'Party Pass';
/** Fixed catalogue price in minor units (pence). */
export const PARTY_PASS_AMOUNT_PENCE = 1999;
export const PARTY_PASS_CURRENCY = 'gbp';
/** Active usage window after explicit activation. */
export const PARTY_PASS_ACTIVE_DAYS = 30;
/** Unactivated purchase must be activated before this many days from purchase. */
export const PARTY_PASS_USE_BY_DAYS = 365;

export interface PartyPassStripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  /** Optional Stripe Price ID; when unset, Checkout uses price_data. */
  priceId: string | null;
  appBaseUrl: string;
  checkoutEnabled: boolean;
  isTestMode: boolean;
}

export class PaymentsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentsConfigError';
  }
}

/**
 * Detect clearly non-real Stripe test placeholders (Preview boot dummies).
 * Real `sk_test_*` secrets from Stripe Dashboard are long and lack these markers.
 */
export function isDummyStripeSecretKey(secretKey: string): boolean {
  const secret = secretKey.trim().toLowerCase();
  if (!secret.startsWith('sk_test_')) return false;
  const markers = [
    'dummy',
    'placeholder',
    'preview',
    'fake',
    'example',
    'xxxx',
    'changeme',
    'not_a_real',
    'test_key',
  ];
  if (markers.some((m) => secret.includes(m))) return true;
  // Stripe Dashboard secrets are long; short sk_test_* values are placeholders.
  return secret.length < 40;
}

/**
 * Preview-safe Party Pass Stripe mock.
 * Requires explicit `PARTY_PASS_STRIPE_MOCK=1` AND a dummy `sk_test_*` placeholder.
 * Never activates on Vercel Production, with live keys, or with real `sk_test_*` secrets.
 */
export function isPartyPassStripeMockActive(): boolean {
  if (process.env.VERCEL_ENV === 'production') {
    return false;
  }
  if (process.env.PARTY_PASS_STRIPE_MOCK !== '1') {
    return false;
  }
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!secret || secret.startsWith('sk_live_')) {
    return false;
  }
  return isDummyStripeSecretKey(secret);
}

/**
 * Checkout is disabled by default on production deployments.
 * Requires PARTY_PASS_CHECKOUT_ENABLED=1 and either:
 * - a Stripe *test* secret key (real Checkout path), or
 * - Preview Stripe mock (`PARTY_PASS_STRIPE_MOCK=1` + dummy `sk_test_*`).
 * Live keys are refused for this PRD (test mode only).
 */
export function isPartyPassCheckoutEnabled(): boolean {
  if (process.env.PARTY_PASS_CHECKOUT_ENABLED !== '1') {
    return false;
  }
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (secret.startsWith('sk_live_')) {
    return false;
  }
  if (isPartyPassStripeMockActive()) {
    return true;
  }
  if (!secret.startsWith('sk_test_')) {
    return false;
  }
  return true;
}

export function assertStripeTestModeSecret(secretKey: string): void {
  if (!secretKey.startsWith('sk_test_')) {
    throw new PaymentsConfigError(
      'Stripe live keys are not permitted for Party Pass in this build (test mode only)'
    );
  }
}

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    '';
  if (!raw) {
    throw new PaymentsConfigError(
      'NEXT_PUBLIC_APP_URL (or APP_BASE_URL) is required for Party Pass checkout'
    );
  }
  return raw.replace(/\/$/, '');
}

/**
 * Load and validate Stripe config for checkout / webhook paths.
 * Throws PaymentsConfigError when required secrets are missing or live.
 * Preview mock mode allows dummy secrets and skips webhook-secret requirement.
 */
export function getPartyPassStripeConfig(): PartyPassStripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
  const publishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    '';
  const mockActive = isPartyPassStripeMockActive();

  if (!secretKey) {
    throw new PaymentsConfigError('STRIPE_SECRET_KEY is not configured');
  }
  assertStripeTestModeSecret(secretKey);

  if (!mockActive && !webhookSecret) {
    throw new PaymentsConfigError('STRIPE_WEBHOOK_SECRET is not configured');
  }

  const priceId = process.env.STRIPE_PARTY_PASS_PRICE_ID?.trim() || null;
  const appBaseUrl = getAppBaseUrl();
  const checkoutEnabled = isPartyPassCheckoutEnabled();

  return {
    secretKey,
    webhookSecret: webhookSecret || (mockActive ? 'whsec_preview_mock' : ''),
    publishableKey,
    priceId,
    appBaseUrl,
    checkoutEnabled,
    isTestMode: true,
  };
}

/** Safe redirect allowlist relative to app base URL. */
export function buildCheckoutRedirectUrls(appBaseUrl: string): {
  successUrl: string;
  cancelUrl: string;
} {
  return {
    successUrl: `${appBaseUrl}/account/party-pass?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appBaseUrl}/account/party-pass?checkout=cancelled`,
  };
}

export function partyPassAmountPence(): number {
  const override = process.env.PARTY_PASS_AMOUNT_PENCE?.trim();
  if (override) {
    const n = Number.parseInt(override, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return PARTY_PASS_AMOUNT_PENCE;
}
