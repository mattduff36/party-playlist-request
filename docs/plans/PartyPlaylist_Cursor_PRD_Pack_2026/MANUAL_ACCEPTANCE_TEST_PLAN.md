# Manual acceptance test plan — PartyPlaylist PRD Pack 2026

Programme §27 coverage for preview branch `preview/partyplaylist-prd-program-2026`.

**Failure reporting:** follow `FAILURE_REPORTING.md` for every Fail/Blocked result.

**Global preconditions**

- Preview deployment (or local) built from programme tip.
- Preview env vars configured per `PREVIEW_ENV_CHECKLIST.md` (names only).
- Stripe: test mode only. Preview may use **Stripe mock** (`PARTY_PASS_STRIPE_MOCK=1` + dummy `sk_test_*`) for Party Pass UX; real Checkout needs real `sk_test_*` (T-36+).
- Two organiser test accounts available (A and B); do not use production customer data.
- Never paste secrets into reports.

For each test: **Preconditions → Steps → Expected → Evidence → Failure info**.

---

## Human sign-off (2026-07-27) — Preview rehearsal

**Signed off by user on 2026-07-27** for the Preview deployment on branch `preview/partyplaylist-prd-program-2026`.

**Caveat:** Spotify OAuth against the Preview URL is **blocked by Spotify redirect URI allowlist** (Dashboard config), **not by application code**. Flows that need a live Spotify link on Preview were verified where Manual / already-connected paths allowed, or accepted as blocked externally.

| Area | T-IDs | Result |
| --- | --- | --- |
| Ready mode switch / `user_events.updated_at` fix verify | T-32 | **Signed off** |
| Recovery matches ACTIVE device | T-35, T-49 | **Signed off** |
| Play controls | T-25, T-26 | **Signed off** (Spotify-on-Preview caveat) |
| Guest request + approve | T-13, T-16 | **Signed off** |
| Open Display | T-19, T-47 | **Signed off** |
| Start → End event | T-08, T-29 | **Signed off** |

Party Pass real Stripe Checkout (T-36+) remains separate; Preview mock path (when enabled) is for entitlement UX only — not a substitute for Stripe Dashboard test-mode rehearsal before production enablement.

---

## Auth & session

### T-01 Organiser registration

- **Preconditions:** Registration enabled; unique email/username available.
- **Steps:** Open register → complete form → submit → confirm email path if required.
- **Expected:** Account created; can reach login; no secrets in client storage beyond intended cookies.
- **Evidence:** Screenshot of success / dashboard entry; note username (not password).
- **Failure info:** HTTP status, form validation messages, console errors.

### T-02 Organiser login

- **Preconditions:** Registered organiser A.
- **Steps:** Login with valid credentials → land in admin.
- **Expected:** HttpOnly session cookie set; admin UI loads; stale `admin_token` Bearer not required.
- **Evidence:** Screenshot admin home; Network shows cookie auth on `/api/auth/me` or equivalent.
- **Failure info:** Status codes, `SESSION_REVOKED` vs invalid credentials distinction.

### T-03 Session transfer

- **Preconditions:** Organiser A logged in on browser 1; start login/transfer on browser 2.
- **Steps:** Complete transfer confirming previous session; use old browser afterward.
- **Expected:** New session active; old session gets `SESSION_REVOKED` on protected calls; history intact.
- **Evidence:** Screenshots both browsers; Network 401/revoked on old session mutation.
- **Failure info:** Whether old JWT still mutates; whether requests/history deleted.

### T-04 Session revocation

- **Preconditions:** Active session; ability to revoke via transfer or support path.
- **Steps:** Revoke session → attempt protected admin mutation.
- **Expected:** Mutation rejected; UI shows session-revoked handling (no refresh loop).
- **Evidence:** Response body code `SESSION_REVOKED`; UI screenshot.
- **Failure info:** Infinite refresh, silent success, or history wipe.

### T-05 Refresh-token invalidation

- **Preconditions:** Valid cookie session then revoked/transferred.
- **Steps:** Call refresh endpoint with revoked session credentials.
- **Expected:** Refresh fails; no new JWT minted from claims alone.
- **Evidence:** Network status + response code.
- **Failure info:** New token issued despite revocation.

### T-06 Logout

- **Preconditions:** Active event with requests; organiser logged in.
- **Steps:** Logout from admin.
- **Expected:** Cookie cleared; event/requests **not** deleted; event state unchanged.
- **Evidence:** Guest can still see event; DB/UI shows requests retained; logout response.
- **Failure info:** Requests deleted or event ended on logout.

---

## Events & guests

### T-07 Event creation

- **Preconditions:** Organiser A authenticated; entitlement/beta allows creation where enforced.
- **Steps:** Create event with name/date → save.
- **Expected:** Event owned by A; appears in admin; tenant-scoped ids.
- **Evidence:** Event id/slug screenshot.
- **Failure info:** Cross-user leakage; 500s.

### T-08 Event activation

- **Preconditions:** Event ready (or beta/Party Pass entitlement path satisfied).
- **Steps:** Activate / set event online via status controls.
- **Expected:** Server enforces entitlement; event becomes live; audit recorded.
- **Evidence:** Status UI + API response.
- **Failure info:** Activation without entitlement; wrong event linked.

### T-09 Guest joining

- **Preconditions:** Live event with open or code entry.
- **Steps:** Open guest join URL → enter as guest.
- **Expected:** Guest session established; cannot access admin APIs.
- **Evidence:** Guest UI screenshot; failed admin API call from guest context.
- **Failure info:** Guest reaches admin data.

### T-10 QR joining

- **Preconditions:** Signage/QR generated for event.
- **Steps:** Scan or open QR target URL on phone.
- **Expected:** Lands on guest (or display) URL only — not admin; QR decodes to expected path.
- **Evidence:** Phone screenshot of landed URL (path only).
- **Failure info:** Admin URL, wrong event, broken QR.

### T-11 Access-code protection

- **Preconditions:** Event with access code enabled.
- **Steps:** Join without code → with wrong code → with correct code.
- **Expected:** Denied / denied / allowed; no plaintext code leakage in errors.
- **Evidence:** Three response statuses; UI messages.
- **Failure info:** Wrong code accepted; code echoed in logs/UI.

### T-12 Guest-session behaviour

- **Preconditions:** Guest joined.
- **Steps:** Refresh page; open second tab; wait idle; attempt another event’s guest cookie on this event.
- **Expected:** Session persists appropriately; cross-event cookie rejected.
- **Evidence:** Network auth outcomes.
- **Failure info:** Cross-event access.

### T-13 Request submission

- **Preconditions:** Guest on live event; search available (Spotify or manual).
- **Steps:** Submit a valid track request.
- **Expected:** Request appears pending for organiser A only.
- **Evidence:** Guest confirmation + admin queue screenshot.
- **Failure info:** Missing request; wrong tenant.

### T-14 Duplicate handling

- **Preconditions:** Same track already pending/approved per policy.
- **Steps:** Submit duplicate.
- **Expected:** Policy message; no silent double-queue contrary to settings.
- **Evidence:** Error/info UI + admin queue count.
- **Failure info:** Unbounded duplicates.

### T-15 Rate limiting

- **Preconditions:** Guest session; known limit.
- **Steps:** Submit requests rapidly beyond limit.
- **Expected:** 429 / friendly limit; no crash; other guests unaffected.
- **Evidence:** Status codes sequence.
- **Failure info:** Unlimited spam; 500s.

### T-16 Approval

- **Preconditions:** Pending request; organiser A.
- **Steps:** Approve request (CSRF-protected).
- **Expected:** Status approved/queued per mode; guest/admin update.
- **Evidence:** Before/after screenshots; Network POST status.
- **Failure info:** CSRF fail; wrong request updated.

### T-17 Rejection

- **Preconditions:** Pending request.
- **Steps:** Reject request.
- **Expected:** Rejected state; retained for history/report; guest notified if designed.
- **Evidence:** Screenshots.
- **Failure info:** Hard delete contrary to retention rules.

### T-18 Realtime updates

- **Preconditions:** Pusher configured; admin + guest open.
- **Steps:** Approve a request; watch both UIs without full reload.
- **Expected:** Live update on admin/guest/display as applicable.
- **Evidence:** Screen recording short clip.
- **Failure info:** No update; wrong channel; cross-tenant event.

### T-19 Display mode

- **Preconditions:** Display token/URL for event.
- **Steps:** Open display; approve a request; observe now-playing/queue.
- **Expected:** Display-only data; no admin controls; token not reusable across events.
- **Evidence:** Display screenshot; failed reuse on other event.
- **Failure info:** Admin leakage; cross-event display.

---

## Isolation

### T-20 Cross-event isolation

- **Preconditions:** Organiser A has events E1 and E2.
- **Steps:** As guest/display of E1, call E2 identifiers.
- **Expected:** Denied / empty; no E2 payloads.
- **Evidence:** Network 403/404 + body redacted.
- **Failure info:** E2 data returned.

### T-21 Cross-organiser isolation

- **Preconditions:** Organiser A and B with separate events.
- **Steps:** While logged in as A, request B’s admin/event APIs by id/username.
- **Expected:** Denied.
- **Evidence:** Status codes.
- **Failure info:** B’s requests/settings visible.

### T-22 Two separate organisers

- **Preconditions:** A and B both live.
- **Steps:** Parallel guest requests on each; approve on A only.
- **Expected:** Queues independent; Pusher updates scoped.
- **Evidence:** Side-by-side screenshots.
- **Failure info:** Cross-talk.

---

## Spotify & playback

### T-23 Spotify OAuth

- **Preconditions:** Spotify credentials + `TOKEN_ENCRYPTION_KEY_V1`; not demo mode.
- **Steps:** Connect Spotify from admin.
- **Expected:** Server-side PKCE/callback; tokens stored encrypted (no tokens in browser/network response bodies).
- **Evidence:** Connected status UI; Network shows redirect to callback without token query leakage.
- **Failure info:** Tokens in localStorage/URL; oauth-session browser exposure.

### T-24 Spotify callback handling

- **Preconditions:** OAuth in progress.
- **Steps:** Complete callback; replay callback URL; use state from another user if possible.
- **Expected:** Success once; replay/cross-user rejected.
- **Evidence:** Second callback status.
- **Failure info:** Replay succeeds.

### T-25 Spotify playback controls

- **Preconditions:** Connected Premium-capable test user + active device.
- **Steps:** Play/pause/skip from admin (capability-gated).
- **Expected:** Controls work or clear capability error; no secret leakage.
- **Evidence:** UI state + Spotify client observation.
- **Failure info:** Silent no-op; unscoped control.

### T-26 Playback device selection

- **Preconditions:** Multiple devices or none.
- **Steps:** Select device; refresh list; test with no device.
- **Expected:** Selected device persisted; clear messaging when none.
- **Evidence:** Screenshots.
- **Failure info:** Wrong user device; crash.

### T-27 Manual request-only mode

- **Preconditions:** Event set to manual playback mode.
- **Steps:** Guest submits; organiser approves; set manual now-playing.
- **Expected:** Full request flow without Spotify playback APIs.
- **Evidence:** Screenshots of manual now-playing.
- **Failure info:** Hard dependency on Spotify.

### T-28 Manual mode without Spotify credentials

- **Preconditions:** Organiser with no Spotify connection / demo isolation.
- **Steps:** Run event entirely in manual mode.
- **Expected:** No Spotify OAuth required; no credential reads/writes.
- **Evidence:** Settings + successful guest→approve path.
- **Failure info:** Forced Spotify connect.

---

## Event lifecycle & beta product

### T-29 Event ending

- **Preconditions:** Live event with requests.
- **Steps:** End event via status (not logout).
- **Expected:** Event offline; history retained; not hard-deleted.
- **Evidence:** Status + history still listed.
- **Failure info:** `DELETE FROM requests` behaviour; data loss.

### T-30 Event history retention

- **Preconditions:** Ended event.
- **Steps:** Re-login days later (or immediately); open history.
- **Expected:** Requests/audit readable; login/logout did not wipe history.
- **Evidence:** History screenshot.
- **Failure info:** Empty history unexpectedly.

### T-31 Event report

- **Preconditions:** Ended event with varied request outcomes.
- **Steps:** Open report; download CSV if available.
- **Expected:** Totals/peaks present; no raw IP; audit actions included as designed.
- **Evidence:** Report UI + CSV header rows (no PII secrets).
- **Failure info:** Missing data; secret columns.

### T-32 Readiness wizard

- **Preconditions:** New or incomplete event.
- **Steps:** Walk wizard; try Ready with failing required checks; fix or override warnings only.
- **Expected:** Ready blocked on required failures; overrides audited for warnings.
- **Evidence:** Score/checklist screenshots.
- **Failure info:** Ready despite failed required checks.

### T-33 Printable signage

- **Preconditions:** Event with guest URL.
- **Steps:** Download A4/A5/table/screen assets; decode QR.
- **Expected:** Print-safe; guest/display URLs only; access code only if opted in.
- **Evidence:** PDF page + decoded URL.
- **Failure info:** Admin URL; low-contrast QR.

### T-34 Event templates

- **Preconditions:** Organiser creating event.
- **Steps:** Apply birthday/house/etc. template; edit settings after.
- **Expected:** Settings prefilled; editable; no child-targeted templates.
- **Evidence:** Settings after apply.
- **Failure info:** Locked settings; policy-violating templates.

### T-35 Recovery guidance

- **Preconditions:** Recovery centre UI available.
- **Steps:** Simulate/open states: Spotify disconnect, no device, Pusher issue, manual fallback.
- **Expected:** Clear actions; no stack traces/secrets.
- **Evidence:** Screenshots per state.
- **Failure info:** Secret leakage; empty guidance.

---

## Party Pass / Stripe (test mode)

### T-36 Stripe test checkout

- **Preconditions:** `PARTY_PASS_CHECKOUT_ENABLED=1`, real `sk_test_*`, publishable test key, `NEXT_PUBLIC_APP_URL`. (Preview mock: `PARTY_PASS_STRIPE_MOCK=1` + dummy `sk_test_*` — UX path only; does not replace Stripe Dashboard rehearsal.)
- **Steps:** Open `/pricing` or `/account/party-pass` → start checkout → pay with Stripe test card (or mock Buy on Preview).
- **Expected:** Server-priced £19.99 GBP; client cannot change price; success page does not grant access from query alone (mock grants via server webhook path, not query string).
- **Evidence:** Checkout amount screenshot; success page + server status.
- **Failure info:** Client price accepted; live mode; grant without webhook/mock server path.

### T-37 Webhook processing

- **Preconditions:** Webhook endpoint + `STRIPE_WEBHOOK_SECRET`; checkout completed.
- **Steps:** Confirm `checkout.session.completed` processed (Stripe CLI or Dashboard).
- **Expected:** Purchase + unactivated entitlement; signature required.
- **Evidence:** Account Party Pass status `purchased`/unactivated.
- **Failure info:** Missing entitlement; activated early.

### T-38 Duplicate webhook handling

- **Preconditions:** Known Stripe event id already processed.
- **Steps:** Replay same webhook delivery.
- **Expected:** Idempotent no-op; single purchase/entitlement.
- **Evidence:** Stripe delivery logs + DB/UI still single row (via support UI counts).
- **Failure info:** Duplicate entitlements.

### T-39 Entitlement creation

- **Preconditions:** Successful paid checkout webhook.
- **Steps:** View `/account/party-pass` / admin Party Pass panel.
- **Expected:** Entitlement exists, source purchase, not active window until activation.
- **Evidence:** Status fields screenshot.
- **Failure info:** Active 30-day window started at purchase.

### T-40 Entitlement activation

- **Preconditions:** Purchased unactivated pass; event selected; confirm true.
- **Steps:** Activate via UI/API with confirmation.
- **Expected:** `starts_at` set; `expires_at` = +30 days; linked event; cannot double-activate casually.
- **Evidence:** Timestamps screenshot.
- **Failure info:** Wrong duration; second concurrent activation.

### T-41 Thirty-day access

- **Preconditions:** Activated pass.
- **Steps:** Start/continue paid live features within window.
- **Expected:** Allowed; countdown/expiry shown.
- **Evidence:** UI countdown + successful event online.
- **Failure info:** Blocked inside window.

### T-42 Expiry

- **Preconditions:** Ability to simulate expiry (support/time travel) or wait; else mark Blocked if no safe sim.
- **Steps:** After expiry, attempt activate/live paid features.
- **Expected:** Live paid features blocked; history still readable.
- **Evidence:** Error statuses + history still open.
- **Failure info:** History deleted; live still allowed.

### T-43 Invalid entitlement access

- **Preconditions:** No pass / refunded / disputed / other user pass id.
- **Steps:** Attempt activation and event online; attempt cross-tenant purchase lookup.
- **Expected:** Denied; no cross-tenant data.
- **Evidence:** Status codes.
- **Failure info:** Access granted; IDOR.

---

## Layouts & resilience

### T-44 Mobile guest layout

- **Preconditions:** Phone or narrow viewport.
- **Steps:** Join + submit request.
- **Expected:** Usable layout; primary actions visible; no horizontal clip of critical controls.
- **Evidence:** Phone screenshots.
- **Failure info:** Unusable controls.

### T-45 Mobile organiser layout

- **Preconditions:** Phone viewport; organiser logged in.
- **Steps:** Approve/reject; open settings essentials.
- **Expected:** Core moderation usable on mobile.
- **Evidence:** Screenshots.
- **Failure info:** Cannot moderate.

### T-46 Desktop organiser layout

- **Preconditions:** Desktop viewport.
- **Steps:** Full admin: queue, Spotify/manual, settings, Party Pass card.
- **Expected:** Coherent layout; no overlapping critical panels.
- **Evidence:** Screenshots.
- **Failure info:** Broken nav.

### T-47 Display-screen layout

- **Preconditions:** Display URL on large viewport / TV scale.
- **Steps:** Show queue/now-playing/QR as configured.
- **Expected:** High contrast; readable distance; no admin chrome.
- **Evidence:** Full-screen screenshot.
- **Failure info:** Admin UI on display.

### T-48 Error states

- **Preconditions:** Ability to trigger offline API / 401 / 429.
- **Steps:** Disconnect network briefly; revoke session; hit rate limit.
- **Expected:** Clear user-facing errors; no secret/stack leakage.
- **Evidence:** Screenshots of error UI.
- **Failure info:** Blank crash; secret in UI.

### T-49 Recovery states

- **Preconditions:** Recovery centre + degraded paths.
- **Steps:** Follow recovery for Spotify/device/Pusher/manual fallback.
- **Expected:** Actionable steps restore or degrade gracefully to manual.
- **Evidence:** Before/after screenshots.
- **Failure info:** Dead-end with no fallback.

---

## Sign-off

| Field | Value |
| --- | --- |
| Tester | User (human) |
| Preview URL | Vercel Preview for `preview/partyplaylist-prd-program-2026` |
| Commit hash | See programme tip at sign-off; hotfix + Stripe mock commits on preview branch |
| Date (UTC) | 2026-07-27 |
| Overall | **Partial** — core organiser/guest/display/lifecycle areas signed off; Spotify-on-Preview OAuth blocked by redirect allowlist; Party Pass real Stripe Checkout still pending credentials / mock UX path |

Return failures using `FAILURE_REPORTING.md`. Do not merge to `main` after testing without explicit approval.
