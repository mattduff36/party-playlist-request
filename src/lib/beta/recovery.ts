/**
 * Event-day recovery diagnostics (PRD-08).
 * Concise organiser guidance — no secrets or stack traces.
 */

export type RecoveryIssueId =
  | 'spotify_disconnected'
  | 'spotify_token_expired'
  | 'no_active_device'
  | 'provider_rate_limit'
  | 'provider_outage'
  | 'pusher_unavailable'
  | 'display_stale'
  | 'internet_interruption'
  | 'manual_fallback';

export interface RecoveryIssue {
  id: RecoveryIssueId;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  guidance: string[];
  actions: Array<{ label: string; href?: string; action?: string }>;
}

export interface RecoverySnapshot {
  playbackMode: 'spotify' | 'manual' | string;
  spotifyConnected: boolean;
  requiresManualReconnect: boolean;
  hasActiveDevice: boolean;
  providerStatus?: string | null;
  playbackFetchedAt?: string | null;
  playbackDegraded?: boolean;
  pusherConfigured: boolean;
  displayStale: boolean;
  eventVersion?: number | null;
  online?: boolean;
}

export function buildRecoveryIssues(
  snapshot: RecoverySnapshot
): RecoveryIssue[] {
  const issues: RecoveryIssue[] = [];
  const isManual = snapshot.playbackMode === 'manual';

  if (!isManual && !snapshot.spotifyConnected) {
    issues.push({
      id: 'spotify_disconnected',
      severity: 'critical',
      title: 'Spotify disconnected',
      guidance: [
        'Reconnect Spotify from the admin Spotify page.',
        'Guests can still browse if pages are open, but queue adds will fail until reconnected.',
        'Switch to Manual request mode if Spotify cannot be restored during the event.',
      ],
      actions: [
        { label: 'Open Spotify settings', href: 'spotify' },
        { label: 'Switch to manual mode', action: 'playback_mode_manual' },
      ],
    });
  }

  if (!isManual && snapshot.requiresManualReconnect) {
    issues.push({
      id: 'spotify_token_expired',
      severity: 'critical',
      title: 'Spotify session needs reconnect',
      guidance: [
        'Your Spotify authorisation expired or was revoked.',
        'Reconnect once — do not share account credentials with guests.',
      ],
      actions: [{ label: 'Reconnect Spotify', href: 'spotify' }],
    });
  }

  if (!isManual && snapshot.spotifyConnected && !snapshot.hasActiveDevice) {
    issues.push({
      id: 'no_active_device',
      severity: 'critical',
      title: 'No active Spotify playback device',
      guidance: [
        'Open Spotify on the speaker/computer that should play audio and start playback once.',
        'Then refresh devices and select the correct device in admin.',
      ],
      actions: [
        { label: 'Refresh devices', action: 'refresh_devices' },
        { label: 'Open Spotify page', href: 'spotify' },
      ],
    });
  }

  if (snapshot.providerStatus === 'rate_limited' || snapshot.playbackDegraded) {
    issues.push({
      id: 'provider_rate_limit',
      severity: 'warning',
      title: 'Provider rate limit or degraded playback sync',
      guidance: [
        'Slow down bulk actions (search / approve bursts).',
        'Playback sync will retry automatically; prefer polling if realtime feels stuck.',
      ],
      actions: [{ label: 'View recovery centre', action: 'stay' }],
    });
  }

  if (
    snapshot.providerStatus === 'outage' ||
    snapshot.providerStatus === 'unavailable'
  ) {
    issues.push({
      id: 'provider_outage',
      severity: 'critical',
      title: 'Music provider outage',
      guidance: [
        'Spotify or the provider API appears unavailable.',
        'Use Manual mode so guests can still submit text requests while audio is handled offline.',
      ],
      actions: [
        { label: 'Enable manual mode', action: 'playback_mode_manual' },
      ],
    });
  }

  if (!snapshot.pusherConfigured) {
    issues.push({
      id: 'pusher_unavailable',
      severity: 'warning',
      title: 'Realtime (Pusher) unavailable',
      guidance: [
        'Admin, display, and guest pages fall back to polling.',
        'Increase polling only if needed; avoid hammering refresh.',
      ],
      actions: [{ label: 'Check display page', href: 'display' }],
    });
  }

  if (snapshot.displayStale) {
    issues.push({
      id: 'display_stale',
      severity: 'warning',
      title: 'Display looks stale or reconnecting',
      guidance: [
        'Wake the display device and confirm the display URL/token is still valid.',
        'Hard-refresh the display tab; re-open with a fresh display token if needed.',
      ],
      actions: [{ label: 'Display settings', href: 'display' }],
    });
  }

  if (snapshot.online === false) {
    issues.push({
      id: 'internet_interruption',
      severity: 'critical',
      title: 'Internet interruption (client)',
      guidance: [
        'Reconnect Wi‑Fi or tether temporarily.',
        'Approvals and Spotify controls need connectivity; keep the current queue playing locally if possible.',
      ],
      actions: [{ label: 'Retry diagnostics', action: 'refresh' }],
    });
  }

  if (isManual) {
    issues.push({
      id: 'manual_fallback',
      severity: 'info',
      title: 'Manual request mode active',
      guidance: [
        'Guests submit track names as text; you mark now-playing / played in admin.',
        'No Spotify Premium device is required in this mode.',
      ],
      actions: [{ label: 'Open requests', href: 'requests' }],
    });
  }

  return issues;
}

export interface PublicRecoveryPayload {
  issues: RecoveryIssue[];
  lastPlaybackRefreshAt: string | null;
  eventVersion: number | null;
  playbackMode: string;
  degraded: boolean;
}
