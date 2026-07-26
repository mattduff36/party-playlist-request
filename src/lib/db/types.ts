/**
 * Canonical domain types for PartyPlaylist DB / event config.
 * Prefer this module over `@/lib/db/schema` (Drizzle tables diverge from live Neon).
 */

import type { DisplayMood } from '@/styles/theme';

export type EventStatus = 'offline' | 'standby' | 'live';
export type RequestStatus =
  | 'pending'
  | 'approving'
  | 'approved'
  | 'rejected'
  | 'played'
  | 'queue_failed';

export interface EventConfig {
  pages_enabled?: {
    requests: boolean;
    display: boolean;
  };
  event_title?: string;
  dj_name?: string;
  venue_info?: string;
  welcome_message?: string;
  secondary_message?: string;
  tertiary_message?: string;
  show_qr_code?: boolean;
  request_limit?: number | null;
  auto_approve?: boolean;
  decline_explicit?: boolean;
  message_text?: string;
  message_duration?: number;
  message_created_at?: string;
  qr_boost_duration?: number;
  /** Guest request + TV display visual mood preset */
  display_mood?: DisplayMood;
  /** @deprecated Prefer display_mood; kept for migration fallback */
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_tertiary_color?: string;
  show_scrolling_bar?: boolean;
  karaoke_mode?: boolean;
  show_approval_messages?: boolean;
  /** @deprecated Prefer Pusher-driven updates; kept for older clients */
  display_refresh_interval?: number;
  /** PRD-07: spotify | manual */
  playback_mode?: 'spotify' | 'manual';
}

export interface TrackData {
  id: string;
  uri: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    id: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  external_urls: {
    spotify: string;
  };
}
