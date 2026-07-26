/**
 * Server-only Stripe client (PRD-09). Never import from client components.
 */

import Stripe from 'stripe';
import {
  assertStripeTestModeSecret,
  getPartyPassStripeConfig,
} from '@/lib/payments/config';

let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const config = getPartyPassStripeConfig();
  assertStripeTestModeSecret(config.secretKey);
  stripeSingleton = new Stripe(config.secretKey, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  });
  return stripeSingleton;
}

/** Test helper — reset cached client between suites. */
export function resetStripeClientForTests(): void {
  stripeSingleton = null;
}

export function redactStripeId(id: string | null | undefined): string {
  if (!id) return '(none)';
  if (id.length <= 12) return `${id.slice(0, 4)}…`;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
