# PRD-08: Paid Beta Product Readiness, Event Setup and Customer Deliverables


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
git switch -c dev/prd-08-paid-beta-readiness-<YYYYMMDD>
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

- Priority: P1/P2 product
- Depends on: PRD-01 through PRD-07 merged
- Primary reference: PartyPlaylist Product Plan sections on customer journeys, differentiation, pricing and roadmap

## Objective

Turn the stabilised system into an observed beta-ready event product before adding public payment. Add a guided readiness flow, event assets, retained event history and recovery guidance so the £19.99 offer can sell an event experience rather than a basic shared queue.

## Product scope

Target private adult events where the organiser already has suitable speakers/playback equipment. Position PartyPlaylist as a self-service party music system with organiser control. Do not claim it replaces every professional DJ or solves venue music licensing.

## Required outcomes

### 1. Event model and lifecycle for beta

Support clear lifecycle states:

- `draft`
- `ready`
- `pre_event` where enabled
- `live`
- `paused/degraded` where needed
- `ended`
- `archived`

Rules:

- One organiser account can prepare future events.
- Beta entitlement may limit concurrent live events, but history remains available.
- Start/end timestamps are recorded.
- Guest and display access follow event state and page settings.
- Event history is never tied to browser login/logout.

### 2. Guided event-readiness wizard

Create a resumable wizard with a readiness score/checklist:

1. Name/date/time and optional venue label
2. Choose Spotify or manual request mode
3. If Spotify: connect account, choose/test playback device, verify play/pause/queue permissions
4. Moderation rules: auto-approve, explicit filter, request limits, duplicate policy
5. Guest access: access code/open entry and pre-event requests
6. Display/theme/message setup
7. QR/signage preview
8. End-to-end test request and approval
9. Recovery checklist and final `Ready` confirmation

Do not mark the event ready when required checks fail. Allow explicit organiser override only for non-critical warnings and record it.

### 3. Event-day recovery centre

Provide concise diagnostics and actions for:

- Spotify disconnected/expired
- No active device
- Provider rate limit/outage
- Pusher unavailable
- Display stale/reconnecting
- Internet interruption
- Manual-mode fallback

Include last successful playback refresh, realtime state and event version. Avoid exposing secrets or internal stack traces.

### 4. Printable QR signage

Generate downloadable event assets from the server:

- A4 poster
- A5 sign
- Table card
- 16:9 screen image/PDF

Include:

- Event title
- QR code
- Short join instructions
- Access code only when the organiser explicitly chooses to print it
- PartyPlaylist branding with optional organiser colour/theme

Use real PDF generation, not a screenshot of a web page. Ensure print-safe margins, high-contrast QR and no private/admin URL.

### 5. Event archive and report

After event end, show a report with:

- Submitted, approved, rejected and played totals
- Unique guest-session count, described as approximate
- Most requested tracks/artists
- Peak request period
- Provider interruptions/degraded periods
- Event start/end/duration
- Downloadable CSV of requests and audit actions

Apply retention/anonymisation rules. Do not expose raw IP identifiers.

### 6. Event templates and rules

Provide a small set of neutral adult/private-event templates such as:

- Birthday party
- Anniversary
- House party
- Wedding reception, only if current legal/platform wording permits it
- Blank/custom

Templates initialise settings but do not lock them. Avoid child-targeted templates while platform policy remains unresolved.

Add initial guardrails:

- Must-play list
- Do-not-play track/artist list
- Artist cooldown
- Maximum active requests per guest
- Duplicate/cooldown explanation shown to guests

Implement guardrails transactionally and make organiser overrides auditable.

### 7. Beta access without public payment

Before Stripe:

- Add a super-admin grant for a time-limited beta entitlement.
- Entitlement controls event activation, not account creation or historical read access.
- Store grant source, start/end, status and audit trail.
- Include an interactive demo mode that uses mock tracks and no real Spotify authorisation.
- Do not consume scarce Spotify development users for anonymous demos.

### 8. Legal/product copy placeholders become real pages

Create complete editable pages/records for:

- Privacy notice
- Terms of service
- Cookie information
- Retention/deletion summary
- Refund/cancellation policy placeholder for PRD-09
- Spotify disconnect/data deletion instructions
- Organiser responsibility for equipment, internet, account eligibility and music permissions

The final legal wording requires professional review. Mark review status in admin configuration and do not present unreviewed placeholders as approved legal advice.

### 9. Observed beta checklist

Add a reusable operator checklist for at least three observed events:

- Setup completed before event
- Guest QR entry tested on iOS/Android
- 50+ simulated requests
- Shared-Wi-Fi rate limiting verified
- Session transfer tested
- Display sleep/reconnect tested
- Spotify token expiry/no-device simulation
- Pusher failure/poll fallback
- Manual fallback used
- End-event report reviewed
- Customer feedback recorded

## Tests

- Wizard resume and readiness gate tests.
- Device/provider test failure prevents ready state unless allowed warning.
- QR assets resolve to guest/display URLs only and scan correctly in test decoding.
- Protected access-code event signage follows organiser disclosure choice.
- Event report uses archived event-scoped data.
- Guardrails work under concurrent submissions.
- Beta entitlement activation/expiry is server-enforced.
- Demo mode never reads/writes production Spotify credentials.
- Accessibility checks for organiser wizard and guest entry.

## Acceptance criteria

- A new organiser can configure and test an event without reading technical documentation.
- Event cannot accidentally be marked ready while required playback/access checks fail.
- QR signage is downloadable and print-ready.
- Event end produces retained history and a useful report.
- Manual fallback and recovery guidance work during a simulated outage.
- Beta entitlement is server-enforced and auditable.
- At least one complete scripted beta rehearsal passes before PRD-09.

## Non-goals

- Public card payment
- Multi-location venue subscriptions
- White-label/custom domains
- Full co-host/agency permissions
