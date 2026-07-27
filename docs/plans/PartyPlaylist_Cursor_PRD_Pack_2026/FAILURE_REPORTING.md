# Failure reporting instructions (manual acceptance)

When a manual acceptance test fails, return the following so the issue can be triaged without guessing.

## Always include

1. **Test number and title** from `MANUAL_ACCEPTANCE_TEST_PLAN.md` (e.g. `T-12 Guest-session behaviour`).
2. **Pass / Fail / Blocked** (Blocked = env/credential missing, not product bug).
3. **Exact UTC timestamp** of the attempt.
4. **Environment**: Preview URL (or localhost), browser + OS + viewport (mobile/desktop).
5. **Accounts used**: organiser username(s), whether second organiser was used; **never** paste passwords, JWTs, cookies, Stripe secrets, or Spotify tokens.
6. **Steps actually performed** (if they diverge from the plan, note the divergence).
7. **Expected vs actual** in one short paragraph each.
8. **Evidence**: screenshot(s), short screen recording, or copied **non-secret** UI error text / HTTP status.
9. **Network**: failing request method + path + status (e.g. `POST /api/payments/checkout → 403`); redact Authorization and cookie headers.
10. **Console**: relevant browser console errors (redact tokens).
11. **Server/logs**: Vercel function log line ids or timestamps only if available; do not paste env values.
12. **Repro reliability**: once / intermittent / always.
13. **Suspected area** (optional): auth, tenant, Spotify, payments, UI layout, etc.

## Never include

- Passwords, session cookies, JWTs, CSRF secrets
- Stripe secret keys, webhook secrets, full Stripe customer objects with PII
- Spotify access/refresh tokens or PKCE verifiers
- Full `DATABASE_URL` or encryption keys
- Card numbers / payment method details

## Severity guidance (for your note)

| Label | Meaning |
| --- | --- |
| Blocking | Cannot continue acceptance; security or data integrity risk |
| Major | Core flow broken; workaround unclear |
| Minor | Cosmetic or non-critical path |
| Env | Missing credential/dashboard config (not a code defect yet) |

## After you send a failure report

Wait for triage. Do not merge preview → `main`. Do not run Class C/D. Do not rotate secrets unless instructed.
