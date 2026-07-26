# Preview environment checklist (names only)

**Do not commit secret values.** Configure these on the Vercel Preview environment for `preview/partyplaylist-prd-program-2026` (and locally in `.env.local` as needed). Production Vercel variables must not be changed for this programme.

## Required core

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon connection string (preview may share Neon; Class B already applied) |
| `JWT_SECRET` | ≥32 characters |
| `NEXT_PUBLIC_APP_URL` | Preview deployment base URL (success/cancel redirects) |
| `CRON_SECRET` | Bearer for `/api/cron/spotify-sync` (fail-closed) |
| `IP_SALT` | Required in production-like preview for IP hashing |

## Realtime (Pusher)

| Variable | Notes |
| --- | --- |
| `PUSHER_APP_ID` | Server |
| `PUSHER_KEY` | Server |
| `PUSHER_SECRET` | Server |
| `PUSHER_CLUSTER` | e.g. `eu` |
| `NEXT_PUBLIC_PUSHER_KEY` | Browser |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Browser |

## Spotify (optional for manual-mode rehearsal)

| Variable | Notes |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | Dashboard app |
| `SPOTIFY_CLIENT_SECRET` | Dashboard app |
| `SPOTIFY_REDIRECT_URI` | Must match Spotify Dashboard + preview callback URL |
| `TOKEN_ENCRYPTION_KEY_V1` | Required when exercising OAuth vault paths |

## Auth / rate-limit (optional hardening)

| Variable | Notes |
| --- | --- |
| `ACCESS_CODE_HMAC_SECRET` | Falls back to `JWT_SECRET` |
| `AUTH_RATE_LIMIT_SALT` | Falls back to `IP_SALT` |
| `UPSTASH_REDIS_REST_URL` | Distributed limits; memory fallback if unset |
| `UPSTASH_REDIS_REST_TOKEN` | Pair with URL |

## Email (optional)

| Variable | Notes |
| --- | --- |
| `RESEND_API_KEY` | Password reset / verification flows |
| `EMAIL_FROM` / `RESEND_FROM_EMAIL` | From address |

## PRD-08 beta

| Variable | Notes |
| --- | --- |
| `BETA_ENTITLEMENT_ENFORCE` | Set `1` to enforce grants outside production |
| `BETA_ENTITLEMENT_BYPASS` | Dev-only; **do not set on production** |

## PRD-09 Party Pass (Stripe test mode only)

| Variable | Notes |
| --- | --- |
| `STRIPE_SECRET_KEY` | Must be `sk_test_*` (live keys refused) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_*` for `/api/payments/webhook` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_*` |
| `STRIPE_PUBLISHABLE_KEY` | Optional server alias |
| `STRIPE_PARTY_PASS_PRICE_ID` | Optional; else server `price_data` £19.99 GBP |
| `PARTY_PASS_AMOUNT_PENCE` | Optional; default `1999` |
| `PARTY_PASS_CHECKOUT_ENABLED` | Must be `1` to enable checkout; keep off until hard gates |

## Explicitly do not set on Preview request handlers

| Variable | Notes |
| --- | --- |
| `ALLOW_DB_BOOTSTRAP` | CLI-only schema bootstrap |
| `SYSTEM_STARTUP_TOKEN` | Removed; must remain absent |
| Live Stripe keys (`sk_live_*`) | Refused by design |

## External dashboard actions (human)

1. Vercel: ensure Preview env vars listed above (names only in this doc).
2. Spotify Developer Dashboard: add Preview callback URL if testing OAuth.
3. Stripe Dashboard (test mode): webhook → Preview `/api/payments/webhook`; configure Customer Portal if testing invoices.
4. Neon: no further Class B pending; Class C/D remain human-gated.
5. Do **not** change Production Vercel env vars for this programme.
