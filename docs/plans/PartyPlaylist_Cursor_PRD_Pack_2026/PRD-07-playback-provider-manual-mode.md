# PRD-07: Playback Provider Abstraction and Spotify-Independent Manual Mode


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
git switch -c dev/prd-07-playback-provider-manual-mode-<YYYYMMDD>
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

- Priority: P1 strategic risk reduction
- Depends on: PRD-06 merged
- Primary reference: Product Plan playback-adapter and non-Spotify fallback recommendations

## Objective

Separate PartyPlaylist's core guest-request/moderation product from Spotify-specific playback. Deliver a useful request-only/manual mode that can run an event without connecting Spotify, while keeping the existing Spotify experience through a provider adapter.

## Product rationale

Spotify quota and commercial-policy suitability remain external decision gates. PartyPlaylist should retain value as a moderated event request system, display and organiser workflow even when provider playback is unavailable or not authorised.

## Required outcomes

### 1. Introduce a provider capability contract

Create a typed server-only interface similar to:

```ts
interface PlaybackProvider {
  readonly id: string;
  getCapabilities(): PlaybackCapabilities;
  getConnectionStatus(context: EventPlaybackContext): Promise<ConnectionStatus>;
  searchTracks?(query: string, context: EventPlaybackContext): Promise<TrackSearchResult[]>;
  getPlaybackState?(context: EventPlaybackContext): Promise<PlaybackSnapshot>;
  addToQueue?(track: ProviderTrack, context: EventPlaybackContext): Promise<QueueOperationResult>;
  pause?(context: EventPlaybackContext): Promise<OperationResult>;
  resume?(context: EventPlaybackContext): Promise<OperationResult>;
  skip?(context: EventPlaybackContext): Promise<OperationResult>;
  setVolume?(value: number, context: EventPlaybackContext): Promise<OperationResult>;
}
```

Use interfaces for shared data, matching project conventions. Actual names may differ, but capability checks must be explicit.

### 2. Implement the Spotify adapter

- Move Spotify-specific service calls behind a `SpotifyPlaybackProvider`.
- Route handlers and UI must not assume all providers can search, queue, control volume or read now-playing.
- Preserve token security and refresh behaviour from PRD-03.
- Map Spotify errors into provider-neutral error categories.
- Include capability flags for queue add, playback controls, now-playing and device selection.

### 3. Implement manual/request-only mode

An organiser can choose `Manual request mode` without Spotify.

Guest experience:

- Submit artist and song title as validated text.
- Optional dedication/reason with strict length, profanity and moderation controls.
- Prevent obvious duplicates using normalised artist/title plus event policy.
- See pending/approved/rejected/played status.

Organiser experience:

- Approve/reject and order PartyPlaylist's own request queue.
- Mark a request as playing and played.
- Edit/correct submitted track metadata.
- Search/copy the artist-title text for use in any legitimate playback service/device.
- Set a manual now-playing item and clear it.

Display experience:

- Show manual now-playing, upcoming PartyPlaylist requests, QR code and notices.
- Clearly label manual mode without showing a Spotify logo or implying Spotify control.

### 4. Store provider-neutral track/request data

- Keep common fields such as title, artists, duration, artwork URL and explicit flag in provider-neutral columns/JSON.
- Store provider ID and provider track ID only when present.
- Manual requests must not require a Spotify URI.
- Existing Spotify requests must migrate without losing history.
- Validate remote artwork URLs or proxy them safely; manual mode may use a neutral placeholder.

### 5. Add an app-owned request queue

- PartyPlaylist controls ordering of approved requests independently of the provider's opaque queue.
- Queue reorder applies to this app-owned queue and is truthful.
- For providers that support queue add, define when an item is sent to the provider: immediately on approval or just-in-time when it reaches the top. Prefer just-in-time if it improves control and duplicate recovery.
- Track provider operation state separately from organiser approval state.
- Display must distinguish `up next in PartyPlaylist` from confirmed provider queue when the provider cannot confirm order.

### 6. Event-level provider selection and fallback

- Store selected provider/mode on the event.
- Readiness flow can switch between Spotify and manual mode before the event.
- During an active event, allow a controlled fallback from Spotify to manual mode without losing requests.
- Switching back must not automatically re-queue every approved item.
- Record provider mode changes in the audit log.

### 7. UI and copy rules

- Hide controls not supported by the active provider.
- Never show successful playback-control messages for unsupported actions.
- Use neutral product terms in common UI, with provider branding only in provider-specific connection areas.
- Add a clear `What this mode does` explanation so organisers understand that manual mode does not play music itself.

## Tests

- Contract tests run against Spotify mock and manual provider.
- Event with no Spotify credentials can complete guest request, approval, reorder, manual now-playing and played flow.
- Provider-specific route cannot access another event.
- Switching to manual mode preserves pending/approved request data.
- Unsupported capability returns typed result and hides UI control.
- Existing Spotify event continues to work through the adapter.
- App-owned queue order is persistent and concurrent reorder is version-safe.
- Display reconnect restores manual now-playing and queue.

## Acceptance criteria

- Core request/admin/display code depends on provider interfaces, not direct Spotify calls.
- Manual mode runs a complete request/moderation/display event without Spotify.
- PartyPlaylist queue reorder is real for the app-owned queue.
- Provider capability flags drive routes and UI.
- Switching modes is audited and non-destructive.
- Product copy accurately describes manual mode limitations.

## Non-goals

- Integrating Apple Music, YouTube or another provider in this PRD
- Audio playback, mixing, crossfading or music-file hosting
- Circumventing provider terms or music licensing
