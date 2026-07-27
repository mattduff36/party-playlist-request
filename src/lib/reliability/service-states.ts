/**
 * Typed degraded / provider service states (PRD-06).
 */

export type ServiceState =
  | 'healthy'
  | 'stale'
  | 'provider_disconnected'
  | 'no_active_device'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'realtime_unavailable';

export interface PlaybackServiceSnapshot {
  fetchedAt: string;
  providerStatus: ServiceState;
  stale: boolean;
  degraded: boolean;
  fingerprint?: string | null;
  isPlaying?: boolean;
  progressMs?: number | null;
}

export function isStaleFetchedAt(
  fetchedAtIso: string | null | undefined,
  staleMs: number
): boolean {
  if (!fetchedAtIso) return true;
  const t = Date.parse(fetchedAtIso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > staleMs;
}
