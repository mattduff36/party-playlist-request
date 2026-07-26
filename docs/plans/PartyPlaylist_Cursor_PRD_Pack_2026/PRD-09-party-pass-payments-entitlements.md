# PRD-09: £19.99 Party Pass Payments, Entitlements and Commercial Launch Controls


## Mandatory Cursor execution rules

This is an implementation specification, not a prompt-optimisation request. Inspect the repository and implement the PRD directly.

### Create a new development branch first

Before changing any source file:

1. Run `git status --short`.
2. Do not discard, reset, stash, overwrite or commit unrelated user work.
3. Start from the latest accepted project baseline, normally `main` after earlier PRDs have been merged.
4. Create a new development branch specifically for this PRD:

```bash
git switch main
git pull --ff-only
git switch -c dev/prd-09-party-pass-payments-<YYYYMMDD>
```

Replace `<YYYYMMDD>` in the branch name with the date the build starts. If the repository does not use `main`, identify the accepted default branch and create the new branch from that branch instead. If the intended branch already exists, create a new uniquely suffixed branch. Never implement a PRD directly on `main`, `master` or a production branch.

### Working rules

- Read the whole PRD before editing.
- Treat the current source code as authoritative when historical documentation disagrees.
- Keep the implementation inside this PRD's scope. Record useful out-of-scope discoveries instead of silently expanding the build.
- Do not run destructive commands against a production database.
- Create a database backup before any real migration. Use a local or non-production database for development and tests.
- Preserve existing user-facing behaviour unless this PRD explicitly changes it for security, correctness or product reasons.
- Add or update automated tests for every changed security boundary and important behaviour.
- Do not suppress TypeScript, ESLint, test or build failures. Fix failures caused by this PRD.
- Never add secrets to source control, fixtures, screenshots, logs or documentation.
- Update relevant documentation and `.env.example` entries.
- Commit the completed PRD locally with a clear conventional commit message. Do not push unless the user explicitly instructs Cursor to push.

### Required completion report

At the end, report:

- Branch name
- Commit hash and message
- Files added, changed and removed
- Database migrations and rollback notes
- Commands and tests run, including exact results
- Manual checks completed
- Remaining risks, assumptions and deferred items
- Any required environment-variable or deployment changes

## Metadata

- Priority: P2 commercial launch
- Depends on: PRD-08 merged and all launch gates below satisfied
- Primary reference: Product Plan recommended £19.99 Party Pass and paid-launch checklist

## Hard start gate

Do not implement or enable public checkout until Matt confirms one of these in the PRD build request or environment configuration:

1. Spotify has provided a written route suitable for the intended paid/private-event usage and expected user scale, or
2. PartyPlaylist is marketed and technically capable of fulfilling the purchased service through PRD-07 manual/request-only mode without promising unavailable Spotify functionality.

Also require reviewed privacy, terms, refund/cancellation and organiser-responsibility wording before production enablement. Code may be built behind a disabled feature flag while approvals are pending.

## Objective

Implement a secure one-off Party Pass priced at £19.99. The pass permits one active event and a 30-day usage window beginning when the organiser deliberately activates it, not automatically at account registration or checkout.

## Commercial rules

- Product: `Party Pass`
- Price: £19.99 including/excluding VAT only as determined by the configured business/tax position. Do not guess tax treatment in code copy.
- Purchase can occur in advance.
- Activation starts the 30-day active window.
- Define and display a use-by date for unactivated purchases.
- One pass supports one active event at a time. Event history remains readable after expiry.
- Refund/cancellation logic follows the reviewed policy and UK consumer requirements.
- Do not advertise unlimited guests until load testing supports a declared limit.

## Required outcomes

### 1. Stripe integration architecture

Use Stripe Checkout and signed webhooks. Add server-only configuration validation for:

- Secret key
- Publishable key
- Webhook signing secret
- Party Pass price/product identifier
- Application base URL
- Currency `gbp`
- Feature flag for checkout

Never trust client-supplied price, product, duration, user ID or success state.

### 2. Purchase and entitlement data model

Create canonical tables/records for:

- Checkout/purchase
- Stripe customer ID
- Checkout session/payment intent IDs
- Product/price snapshot
- Payment/refund/dispute status
- Entitlement type
- Purchased, activated, starts, expires and use-by timestamps
- Linked user and optionally linked event
- Webhook event ledger with unique Stripe event ID
- Audit trail

Do not store full card data.

### 3. Checkout flow

- Require an active verified organiser session.
- Create or reuse a Stripe customer mapped server-side.
- Create Checkout Session with fixed server-side Party Pass price.
- Put only non-sensitive internal references in Stripe metadata.
- Use strict success/cancel redirect allowlists.
- The success page must retrieve server-verified purchase status. A query string alone never grants access.
- Prevent duplicate active Checkout Sessions where practical.

### 4. Idempotent webhook processing

Handle at minimum the events actually required for Checkout/payment/refund/dispute lifecycle.

Requirements:

- Verify Stripe signature using raw request body.
- Insert Stripe event ID into a unique ledger before applying effects, using a transaction/idempotent design.
- Safely handle out-of-order and repeated events.
- Reconcile purchase state from Stripe object identifiers rather than trusting metadata alone.
- Never activate the 30-day window on checkout completion unless the product rule explicitly says activation at purchase. Default rule: purchased but unactivated.
- Refund/dispute updates entitlement according to reviewed policy and records an audit event.
- Return appropriate retry status for transient failures.

### 5. Entitlement enforcement

Create one server-side entitlement service used by event activation and relevant routes.

It must answer:

- Does the account have an eligible unactivated or active Party Pass?
- Is the pass inside its use-by and active period?
- Which event is linked?
- Can another event become live?
- What read-only access remains after expiry?

Rules:

- Activation is an explicit organiser action with confirmation.
- Activation sets `starts_at` and `expires_at = starts_at + 30 days` in one transaction.
- Link the pass to the chosen event.
- Expiry prevents starting/continuing paid live features according to clearly documented grace behaviour, but never deletes history.
- Server routes enforce entitlement. UI hiding is not security.
- Super-admin complimentary/beta grants use the same entitlement interface with a different source.

### 6. Account and purchase UI

Add:

- Pricing/checkout page
- Purchase status page
- Account entitlement card
- Activation flow selecting an event
- Countdown and exact expiry date/time
- Invoices/receipts link through Stripe-hosted customer tools where appropriate
- Clear prerequisites: compatible music account when using Spotify, internet, playback device and speakers
- Clear manual-mode option and limitations

Do not use fake scarcity or misleading savings claims.

### 7. Refund, cancellation and support handling

- Expose support-visible purchase/entitlement status without card data.
- Add audited super-admin actions only where Stripe APIs and policy permit.
- Do not implement arbitrary database toggles that disagree with Stripe.
- Link refunds to Stripe and let webhook reconciliation update local state.
- Record customer-visible status and next action.

### 8. Security and privacy

- Protect checkout creation and entitlement mutations with PRD-02 auth/CSRF.
- Rate-limit checkout creation.
- Redact Stripe objects and customer details in logs.
- Store only required billing identifiers and document retention/processors.
- Validate all webhook/object payloads.
- Add alerting for repeated webhook failures, signature failures and entitlement mismatches without exposing customer data.

### 9. Launch analytics

Record privacy-conscious funnel events:

- Pricing viewed
- Checkout started
- Purchase completed
- Pass activated
- Event ready
- Event started/ended
- Refund requested/completed

Use stable internal IDs and aggregate reporting. Do not send guest request content or Spotify tokens to analytics.

## Tests

Use Stripe test mode and fixtures:

- Server ignores client-supplied price/duration/user fields.
- Forged webhook rejected.
- Same webhook delivered repeatedly creates one purchase/effect.
- Out-of-order events reconcile correctly.
- Success URL without verified payment grants nothing.
- Purchase remains unactivated after payment.
- Activation starts exactly one 30-day window and cannot be repeated or moved without defined support flow.
- One pass cannot run two concurrent events.
- Expired/use-by rules enforced server-side.
- Refund/dispute updates entitlement correctly.
- Old/revoked admin session cannot create checkout or activate pass.
- Cross-tenant purchase lookup is impossible.
- Manual-mode buyer can fulfil the product without Spotify credentials.

## Acceptance criteria

- £19.99 GBP price is controlled by Stripe/server configuration, never the client.
- Webhooks are signature-verified, idempotent and transactionally applied.
- Party Pass is purchased first and explicitly activated later.
- Activation creates one 30-day event window.
- Entitlement enforcement is central and server-side.
- Purchase/refund/dispute states are auditable and reconciled with Stripe.
- Checkout remains disabled in production until platform/legal hard gates are marked complete.
- Full test-mode checkout, activation, event and expiry rehearsal passes.

## Non-goals

- Subscription billing
- Party Plus, venue or agency tiers
- Marketplace/tip-jar payments
- VAT/legal determination by the developer or LLM
