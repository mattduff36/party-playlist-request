# PRD-03: Spotify OAuth, PKCE and Stored Credential Security


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
git switch -c dev/prd-03-spotify-oauth-token-security-<YYYYMMDD>
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

- Priority: P0/P1 security
- Depends on: PRD-02 merged
- Primary references: SEC-06, SEC-08, SEC-17 and the Product Plan's Spotify decision gate

## Objective

Make Spotify authorisation server-owned, user-bound, single-use and auditable. Stop exposing PKCE verifier material, stop accepting client-supplied verifiers and stop writing Spotify access/refresh tokens as plaintext.

## Current verified problems

- `/api/spotify/oauth-session` returns the PKCE `code_verifier` to a caller who knows the state.
- The callback flow redirects the Spotify code/state to a browser page, then accepts a client-supplied verifier in a POST.
- State is not atomically consumed while proving it belongs to the current authenticated user.
- Spotify tokens are stored in plaintext database columns.
- Debug logs include token-save detail, code/verifier prefixes, user identifiers and verbose Spotify errors.

## Required outcomes

### 1. Replace the OAuth session model

Store an OAuth transaction server-side with at least:

- Random state hash or HMAC
- User ID
- PKCE verifier ciphertext or server-only protected value
- Created and expiry timestamps
- Intended post-callback redirect identifier from a strict allowlist
- Single-use/consumed state

Requirements:

- State must use cryptographically secure randomness.
- Store only a hash/HMAC of state where practical. The raw state travels in the OAuth request and cookie/session binding.
- Expire transactions quickly, normally 10 minutes or less.
- Starting a new Spotify connection invalidates previous unconsumed transactions for the same user.
- Do not expose the verifier through any API response or client bundle.

### 2. Complete token exchange in the server callback

Refactor the Spotify callback so the server:

1. Receives `code`, `state` or provider error.
2. Validates the active organiser session from PRD-02.
3. Atomically loads and consumes the matching OAuth transaction.
4. Proves transaction `user_id` equals the authenticated user.
5. Exchanges the code using the stored PKCE verifier.
6. Encrypts and stores the tokens.
7. Deletes/invalidates the OAuth transaction.
8. Redirects to a fixed organiser Spotify result page with only a success/error code, never tokens or OAuth secrets.

Remove `/api/spotify/oauth-session`. Remove client POST exchange logic and client-supplied `code_verifier`.

If the Spotify redirect can legitimately lose the organiser cookie in a supported deployment, use a separate signed, HttpOnly, short-lived OAuth binding cookie. Do not weaken user binding.

### 3. Implement a versioned token vault

Create a server-only token-encryption service using authenticated encryption, preferably AES-256-GCM with a 32-byte environment key or a managed KMS/envelope design.

Minimum envelope data:

- Ciphertext
- IV/nonce
- Authentication tag
- Key version
- Algorithm/version marker

Requirements:

- `TOKEN_ENCRYPTION_KEY_V1` or equivalent must be mandatory in production.
- Validate key length and format at startup.
- Use separate random nonces for every encryption.
- Bind ciphertext to user/provider/token type through authenticated additional data.
- Never log plaintext, key material, ciphertext payloads or decrypted prefixes.
- Decrypt only inside the Spotify service immediately before use.
- Design for key rotation with multiple read keys and one active write key.

### 4. Migrate existing plaintext tokens safely

Create a staged migration, not an irreversible one-step change:

- Add encrypted token envelope columns or a new provider-credentials table.
- New writes use encryption only.
- A non-production migration command converts existing tokens and verifies decryption.
- Production migration requires backup and an explicit operator command.
- During a short transition, allow read-old/write-new only behind a migration flag.
- After verification, remove plaintext values and then remove plaintext columns in a separate migration.
- Never include real tokens in migration logs.

Document exact rollback boundaries. A rollback must not require printing decrypted tokens.

### 5. Tighten token lifecycle

- Refresh tokens through the token vault and replace them when Spotify rotates them.
- Use database locking or compare-and-swap to prevent two simultaneous refreshes overwriting each other.
- On disconnect, remove access token, refresh token, provider profile data, caches and outstanding OAuth transactions for that user.
- On account deletion, remove provider credentials.
- Return an explicit connection status without exposing scopes or provider identity data unnecessarily.
- Ensure all Spotify API errors are mapped to typed internal categories such as expired authorisation, development-mode denial, rate limit, no active device and provider outage.

### 6. Logging and validation

- Replace verbose callback/service console logging with structured redacted logs.
- Add request/response schemas for OAuth bodies and Spotify token responses.
- Validate token response shape at runtime before storage.
- Do not return raw provider error bodies or stack traces to the browser.
- Allow only known redirect destinations.

## Tests

Add tests proving:

- OAuth verifier never appears in browser responses, client props or logs.
- State is single-use and expires.
- A user cannot complete another user's OAuth transaction.
- Callback without an active current session fails safely.
- Concurrent callbacks cannot consume the same state twice.
- Stored database values do not contain known plaintext test tokens.
- Tampered ciphertext, IV, tag or additional data fails decryption.
- Key-version rotation reads old ciphertext and writes new-version ciphertext.
- Concurrent refresh does not corrupt the latest refresh token.
- Disconnect deletes provider credentials and invalidates cache/session data.
- Logs and API responses do not contain token/code/verifier fixtures.

## Acceptance criteria

- `/api/spotify/oauth-session` no longer exists.
- No client supplies or receives a PKCE verifier.
- OAuth state is atomically consumed and bound to the current authenticated user.
- New Spotify token writes are encrypted with authenticated, versioned encryption.
- A documented migration path exists for existing plaintext rows.
- Disconnect and account deletion remove Spotify personal data.
- Spotify errors are typed, redacted and user-safe.
- All tests pass without placing encryption keys in source control.

## Non-goals

- Proving Spotify commercial approval or quota suitability
- Durable watcher redesign - PRD-06
- Provider abstraction/manual mode - PRD-07
