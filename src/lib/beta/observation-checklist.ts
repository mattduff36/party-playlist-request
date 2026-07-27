/**
 * Observed beta rehearsal checklist (PRD-08).
 */

export type ObservationItemId =
  | 'setup_completed'
  | 'qr_ios_android'
  | 'simulated_50_requests'
  | 'shared_wifi_rate_limit'
  | 'session_transfer'
  | 'display_sleep_reconnect'
  | 'spotify_token_no_device'
  | 'pusher_poll_fallback'
  | 'manual_fallback'
  | 'end_event_report'
  | 'customer_feedback';

export interface ObservationItem {
  id: ObservationItemId;
  label: string;
}

export const OBSERVATION_ITEMS: ObservationItem[] = [
  { id: 'setup_completed', label: 'Setup completed before event' },
  { id: 'qr_ios_android', label: 'Guest QR entry tested on iOS/Android' },
  { id: 'simulated_50_requests', label: '50+ simulated requests' },
  {
    id: 'shared_wifi_rate_limit',
    label: 'Shared-Wi-Fi rate limiting verified',
  },
  { id: 'session_transfer', label: 'Session transfer tested' },
  { id: 'display_sleep_reconnect', label: 'Display sleep/reconnect tested' },
  {
    id: 'spotify_token_no_device',
    label: 'Spotify token expiry / no-device simulation',
  },
  { id: 'pusher_poll_fallback', label: 'Pusher failure / poll fallback' },
  { id: 'manual_fallback', label: 'Manual fallback used' },
  { id: 'end_event_report', label: 'End-event report reviewed' },
  { id: 'customer_feedback', label: 'Customer feedback recorded' },
];

export type ObservationChecklistState = Partial<
  Record<ObservationItemId, boolean>
>;

export function emptyObservationChecklist(): ObservationChecklistState {
  const state: ObservationChecklistState = {};
  for (const item of OBSERVATION_ITEMS) {
    state[item.id] = false;
  }
  return state;
}
