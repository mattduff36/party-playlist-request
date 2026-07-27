# PRD-09 Party Pass — environment checklist

**Do not commit secret values.** This file lists names and presence requirements only.

## Required for test-mode checkout (human credentials)

| Variable | Presence needed | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | YES | Must be `sk_test_*`. Live keys are refused. |
| `STRIPE_WEBHOOK_SECRET` | YES | Endpoint signing secret (`whsec_*`) for `/api/payments/webhook` (signature required; forged/missing rejected) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Recommended | `pk_test_*` (or `STRIPE_PUBLISHABLE_KEY`) |
| `NEXT_PUBLIC_APP_URL` | YES | Base URL for success/cancel redirects |
| `PARTY_PASS_CHECKOUT_ENABLED` | YES to enable | Must be `1`. Default off on production path. |

## Optional

| Variable | Notes |
| --- | --- |
| `STRIPE_PARTY_PASS_PRICE_ID` | When unset, Checkout uses server `price_data` at £19.99 GBP |
| `PARTY_PASS_AMOUNT_PENCE` | Override catalogue amount (default `1999`) |
| `STRIPE_PUBLISHABLE_KEY` | Server-side alias if not using `NEXT_PUBLIC_` |
| `PARTY_PASS_STRIPE_MOCK` | Preview-only. Set `1` **with** a clearly dummy `sk_test_*` placeholder to accept payment without Stripe network. See below. |

## Preview Stripe mock (Party Pass UX)

Use when Preview has dummy Stripe placeholders and you need the Buy button to mark payment accepted (same DB grant path as webhook).

| Gate | Rule |
| --- | --- |
| Explicit flag | `PARTY_PASS_STRIPE_MOCK=1` |
| Dummy key | `STRIPE_SECRET_KEY` must be a short / marker placeholder (`dummy`, `placeholder`, etc.) under `sk_test_*` |
| Checkout flag | `PARTY_PASS_CHECKOUT_ENABLED=1` so the button is enabled |
| Never Production | Inactive when `VERCEL_ENV=production` |
| Never live keys | Inactive for any `sk_live_*` |
| Real test keys | If a real-length `sk_test_*` is present, mock stays **off** and the real Stripe Checkout path is used |

Behaviour: POST `/api/payments/checkout` creates a `cs_mock_*` session and runs `processStripeWebhookEvent` for a synthetic `checkout.session.completed` (paid GBP catalogue amount) → purchase `paid` + entitlement `purchased` (not activated).

**Do not set `PARTY_PASS_STRIPE_MOCK` on Production.** Prefer real Stripe test keys + webhook for T-36+ acceptance before any production enablement.

## Hard gates (keep checkout disabled until complete)

1. Spotify written route **or** Manual-mode fulfilment path approved for marketing claims.
2. Reviewed privacy / terms / refund / organiser-responsibility wording.
3. Explicit production enablement of `PARTY_PASS_CHECKOUT_ENABLED=1` with test→live cutover process (live keys not supported in this PRD build).

## Local webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Use the CLI `whsec_` value as `STRIPE_WEBHOOK_SECRET` locally.
