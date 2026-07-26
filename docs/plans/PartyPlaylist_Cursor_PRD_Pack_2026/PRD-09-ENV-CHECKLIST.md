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

## Hard gates (keep checkout disabled until complete)

1. Spotify written route **or** Manual-mode fulfilment path approved for marketing claims.
2. Reviewed privacy / terms / refund / organiser-responsibility wording.
3. Explicit production enablement of `PARTY_PASS_CHECKOUT_ENABLED=1` with test→live cutover process (live keys not supported in this PRD build).

## Local webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Use the CLI `whsec_` value as `STRIPE_WEBHOOK_SECRET` locally.
