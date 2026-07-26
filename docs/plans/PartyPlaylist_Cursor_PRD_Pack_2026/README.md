# PartyPlaylist Cursor PRD Pack

Prepared from:

- `PartyPlaylist_Product_Plan_2026.docx`
- `PartyPlaylist_Codebase_Review_2026.docx`
- PartyPlaylist source archive `party-playlist-request` version 2.1.26, reviewed 26 July 2026

The PRDs repeat the relevant findings, so Cursor can execute them without reading the two Word documents. The Word documents remain useful as broader strategy and audit references.

## Why the work is divided this way

The project already contains a substantial product, but urgent security defects and conflicting infrastructure make a single large implementation prompt unsafe. Each PRD creates a reviewable branch and commit. Complete, test and review one PRD before starting the next.

## Recommended execution order

| Order | PRD | Purpose | Gate before moving on |
|---|---|---|---|
| 1 | PRD-01 Production Lockdown | Remove immediately dangerous public operations and insecure fallbacks | No unauthenticated DDL, startup control, legacy data exposure or full public telemetry |
| 2 | PRD-02 Authentication and Session Authority | Make server-side session revocation authoritative and separate logout from event termination | A transferred or revoked session cannot call or refresh protected APIs |
| 3 | PRD-03 Spotify OAuth and Token Security | Keep PKCE material server-side, bind OAuth to the user and encrypt stored tokens | OAuth replay/cross-user tests pass and plaintext writes stop |
| 4 | PRD-04 Tenant, Guest and Realtime Isolation | Secure Pusher channels, display access and tenant-scoped public APIs | Cross-tenant and protected-event regression suite passes |
| 5 | PRD-05 Canonical Database and Quality Gates | Establish one data model, migration path, connection strategy and trustworthy CI | Fresh database build, type-check, lint, tests and production build all pass |
| 6 | PRD-06 Distributed Reliability and Data Integrity | Remove process-local coordination, add idempotency and archive event data | Concurrency and multi-instance tests pass; logout/end-event never destroys history |
| 7 | PRD-07 Playback Provider Abstraction and Manual Mode | Reduce Spotify dependency and make queue capabilities truthful | Event can run in request-only/manual mode without Spotify |
| 8 | PRD-08 Paid Beta Product Readiness | Add event readiness, archive/reporting and event assets before charging | Observed end-to-end beta event can recover from common failures |
| 9 | PRD-09 Party Pass Payments and Entitlements | Add the £19.99 30-day Party Pass with secure Stripe processing | Idempotent webhook and entitlement tests pass; legal/platform gates are signed off |

## Branching and review model

Every PRD requires a new development branch at the start. The next PRD should normally branch from `main` only after the previous PRD has been reviewed and merged. Do not create one long branch containing all nine PRDs unless Matt explicitly chooses that workflow.

Suggested review loop:

1. Feed `CURSOR_MASTER_INSTRUCTIONS.md` and one PRD to Cursor.
2. Let Cursor inspect and implement the PRD on its new branch.
3. Review the diff, migration and test output.
4. Test the relevant organiser, guest and display journeys manually.
5. Merge the branch only when its acceptance criteria pass.
6. Start the next PRD from the newly accepted baseline.

## Global release gates

Do not open paid public access until all of the following are true:

- PRD-01 through PRD-06 are complete and independently reviewed.
- Spotify commercial/quota suitability has written confirmation, or PRD-07 manual mode is good enough to support the advertised service without promising Spotify playback.
- Type-check, lint, unit, API, production build and smoke E2E run as blocking CI checks.
- A clean database can be created solely from the canonical migration set.
- A real beta event has tested network loss, Spotify expiry, no active playback device, display reconnect and organiser session transfer.
- Privacy, terms, retention, refund and music-responsibility wording is complete.
