/**
 * POST /api/payments/webhook — Stripe signed webhooks (PRD-09).
 * Raw body + signature verification. No CSRF (Stripe signature is the auth).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  alertWebhookFailure,
  constructStripeEvent,
  processStripeWebhookEvent,
  WebhookSignatureError,
} from '@/lib/payments/webhook';
import { PaymentsConfigError } from '@/lib/payments/config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    alertWebhookFailure('body_read_failed');
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  try {
    const event = constructStripeEvent(rawBody, signature);
    const result = await processStripeWebhookEvent(event);
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      handled: result.handled,
      type: result.eventType,
    });
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      alertWebhookFailure('signature_invalid');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    if (error instanceof PaymentsConfigError) {
      alertWebhookFailure('config_missing');
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    alertWebhookFailure('processing_failed', {
      message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    });
    // 500 so Stripe retries transient failures
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
