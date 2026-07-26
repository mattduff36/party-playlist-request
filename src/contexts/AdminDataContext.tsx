'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { usePusher } from '@/hooks/usePusher';
import {
  RequestApprovedEvent,
  RequestRejectedEvent,
  RequestSubmittedEvent,
  RequestDeletedEvent,
} from '@/lib/pusher';
import { formatArtists } from '@/lib/format-artists';
import type { DisplayMood } from '@/styles/theme';
import {
  authenticatedFetch,
  handleSessionRevokedResponse,
} from '@/lib/api/authenticated-fetch';

export interface Request {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_image_url?: string | null;
  track_uri: string;
  duration_ms?: number;
  requester_nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface QueueTrack {
  id?: string;
  uri?: string;
  name: string;
  artists?: string | string[] | Array<{ name?: string }>;
  image_url?: string | null;
  album?: string | { name?: string; images?: Array<{ url?: string }> };
  requester_nickname?: string | null;
  requesterNickname?: string | null;
}

export interface PlaybackState {
  spotify_connected: boolean;
  is_playing: boolean;
  track_name?: string;
  artist_name?: string;
  album_name?: string;
  duration_ms?: number;
  progress_ms?: number;
  image_url?: string;
  device_name?: string;
  volume_percent?: number;
  queue?: QueueTrack[];
  /** Server/Pusher timestamp for progress anchoring */
  timestamp?: number;
}

export interface EventSettings {
  event_title: string;
  dj_name: string;
  venue_info: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  show_qr_code: boolean;
  display_refresh_interval: number;
  show_approval_messages?: boolean;
  request_limit?: number | null;
  auto_approve?: boolean;
  decline_explicit?: boolean;
  qr_boost_duration?: number;
  display_mood?: DisplayMood;
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_tertiary_color?: string;
  show_scrolling_bar?: boolean;
  karaoke_mode?: boolean;
  secure_url_access?: boolean;
  pages_enabled?: {
    requests: boolean;
    display: boolean;
  };
  message_text?: string;
  message_duration?: number;
  message_created_at?: string;
}

export interface Stats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  played_requests: number;
  unique_requesters: number;
  spotify_connected: boolean;
}

interface AdminDataContextType {
  requests: Request[];
  playbackState: PlaybackState | null;
  eventSettings: EventSettings | null;
  stats: Stats | null;
  loading: boolean;
  /** Debounced Spotify connection truth for all admin UI */
  spotifyConnected: boolean;
  setSpotifyConnected: (connected: boolean, immediate?: boolean) => void;
  isConnected: boolean;
  connectionState: string;
  handlePlaybackControl: (action: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshPlaybackState: () => Promise<void>;
  patchPlaybackState: (patch: Partial<PlaybackState>) => void;
  updateEventSettings: (settings: Partial<EventSettings>) => Promise<void>;
  handleSpotifyDisconnect: () => Promise<void>;
  handleApprove: (id: string, playNext?: boolean) => Promise<void>;
  handleReject: (id: string, reason?: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handlePlayAgain: (id: string, playNext?: boolean) => Promise<void>;
  handleQueueReorder: (fromIndex: number, toIndex: number) => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextType | null>(null);

const CONNECTED_FALSE_DEBOUNCE_MS = 1000;
const CONNECTED_FALSE_STREAK = 2;
const QUEUE_REORDER_LOCK_MS = 4000;
const PLAYBACK_POLL_UNTIL_TRACK_MS = 12000;
const HYDRATE_RETRY_DELAYS_MS = [500, 1500, 3000];
/** Staleness budget for request-driven Spotify sync (meets ~5s SLA). */
const PLAYBACK_STALE_MS = 5_000;
const PLAYBACK_STALE_CHECK_MS = 1_000;

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [spotifyConnected, setSpotifyConnectedState] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const requestsGenRef = useRef(0);
  const statsGenRef = useRef(0);
  const playbackGenRef = useRef(0);
  const queueReorderLockUntilRef = useRef(0);
  const disconnectedStreakRef = useRef(0);
  const disconnectedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const confirmedDisconnectedRef = useRef(false);
  const hasConfirmedTrackRef = useRef(false);
  const hydrateRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPlaybackEventAtRef = useRef<number>(Date.now());
  const lastSyncAttemptAtRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const adminInitGenRef = useRef(0);

  const clearDisconnectedDebounce = useCallback(() => {
    disconnectedStreakRef.current = 0;
    if (disconnectedDebounceRef.current) {
      clearTimeout(disconnectedDebounceRef.current);
      disconnectedDebounceRef.current = null;
    }
  }, []);

  const setSpotifyConnected = useCallback(
    (connected: boolean, immediate = false) => {
      if (connected) {
        clearDisconnectedDebounce();
        confirmedDisconnectedRef.current = false;
        setSpotifyConnectedState(true);
        setPlaybackState((prev) =>
          prev ? { ...prev, spotify_connected: true } : prev
        );
        setStats((prev) =>
          prev ? { ...prev, spotify_connected: true } : prev
        );
        return;
      }

      if (immediate) {
        clearDisconnectedDebounce();
        confirmedDisconnectedRef.current = true;
        hasConfirmedTrackRef.current = false;
        setSpotifyConnectedState(false);
        setPlaybackState((prev) =>
          prev
            ? {
                ...prev,
                spotify_connected: false,
                is_playing: false,
                track_name: undefined,
                artist_name: undefined,
                album_name: undefined,
                image_url: undefined,
                queue: [],
              }
            : null
        );
        setStats((prev) =>
          prev ? { ...prev, spotify_connected: false } : prev
        );
        return;
      }

      disconnectedStreakRef.current += 1;
      if (disconnectedStreakRef.current >= CONNECTED_FALSE_STREAK) {
        clearDisconnectedDebounce();
        confirmedDisconnectedRef.current = true;
        setSpotifyConnectedState(false);
        setPlaybackState((prev) =>
          prev ? { ...prev, spotify_connected: false } : prev
        );
        setStats((prev) =>
          prev ? { ...prev, spotify_connected: false } : prev
        );
        return;
      }

      if (!disconnectedDebounceRef.current) {
        disconnectedDebounceRef.current = setTimeout(() => {
          disconnectedDebounceRef.current = null;
          if (disconnectedStreakRef.current > 0) {
            disconnectedStreakRef.current = 0;
            confirmedDisconnectedRef.current = true;
            setSpotifyConnectedState(false);
            setPlaybackState((prev) =>
              prev ? { ...prev, spotify_connected: false } : prev
            );
            setStats((prev) =>
              prev ? { ...prev, spotify_connected: false } : prev
            );
          }
        }, CONNECTED_FALSE_DEBOUNCE_MS);
      }
    },
    [clearDisconnectedDebounce]
  );

  const refreshRequestsRef = useRef<() => Promise<void>>(async () => {});
  const refreshStatsRef = useRef<() => Promise<void>>(async () => {});
  const refreshPlaybackStateRef = useRef<() => Promise<void>>(async () => {});
  const refreshEventSettingsRef = useRef<() => Promise<void>>(async () => {});

  const { isConnected, connectionState } = usePusher({
    onRequestApproved: () => {
      void refreshRequestsRef.current();
      void refreshStatsRef.current();
    },
    onRequestRejected: () => {
      void refreshRequestsRef.current();
      void refreshStatsRef.current();
    },
    onRequestDeleted: () => {
      void refreshRequestsRef.current();
      void refreshStatsRef.current();
    },
    onRequestSubmitted: () => {
      void refreshRequestsRef.current();
      void refreshStatsRef.current();
    },
    onForceLogout: (data: any) => {
      localStorage.removeItem('admin_token');
      alert(
        data.message ||
          'You have been logged out because this session was transferred to another device.'
      );
      window.location.href = '/login';
    },
    onRequestsCleanup: () => {
      void refreshRequestsRef.current();
      void refreshStatsRef.current();
    },
    onStatsUpdate: (data: any) => {
      setStats((prev) => {
        const next: Stats = {
          total_requests: data.total_requests ?? prev?.total_requests ?? 0,
          pending_requests: data.pending_requests ?? prev?.pending_requests ?? 0,
          approved_requests:
            data.approved_requests ?? prev?.approved_requests ?? 0,
          rejected_requests:
            data.rejected_requests ?? prev?.rejected_requests ?? 0,
          played_requests: data.played_requests ?? prev?.played_requests ?? 0,
          unique_requesters:
            data.unique_requesters ?? prev?.unique_requesters ?? 0,
          spotify_connected:
            typeof data.spotify_connected === 'boolean'
              ? data.spotify_connected
              : (prev?.spotify_connected ?? false),
        };
        return JSON.stringify(prev) !== JSON.stringify(next) ? next : prev;
      });
      if (typeof data.spotify_connected === 'boolean') {
        setSpotifyConnected(data.spotify_connected);
      }
    },
    onPlaybackUpdate: (data: any) => {
      if (confirmedDisconnectedRef.current) {
        return;
      }
      if (Date.now() < queueReorderLockUntilRef.current && Array.isArray(data.queue)) {
        // Apply track/playing updates but skip queue overwrite during reorder lock
        data = { ...data, queue: undefined };
      }

      if (
        data.current_track ||
        data.queue ||
        data.is_playing !== undefined ||
        data.progress_ms !== undefined
      ) {
        setPlaybackState((prev) => {
          const next: PlaybackState = {
            ...(prev || {
              spotify_connected: false,
              is_playing: false,
            }),
            spotify_connected: true,
            timestamp:
              typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
          };

          if (data.progress_ms !== undefined) {
            next.progress_ms = data.progress_ms;
          }
          if (data.current_track) {
            next.track_name = data.current_track.name;
            next.artist_name = formatArtists(data.current_track.artists ?? null);
            next.album_name =
              data.current_track.album?.name || data.current_track.album || '';
            next.duration_ms = data.current_track.duration_ms;
            next.image_url =
              data.current_track.album?.images?.[1]?.url ||
              data.current_track.album?.images?.[0]?.url ||
              data.current_track.image_url;
            if (data.is_playing !== undefined) {
              next.is_playing = Boolean(data.is_playing);
            }
            hasConfirmedTrackRef.current = true;
          } else if (data.is_playing !== undefined) {
            next.is_playing = Boolean(data.is_playing);
          }
          if (data.device?.name) {
            next.device_name = data.device.name;
          }
          if (typeof data.device?.volume_percent === 'number') {
            next.volume_percent = data.device.volume_percent;
          }
          if (Array.isArray(data.queue)) {
            next.queue = data.queue;
          } else if (prev?.queue) {
            next.queue = prev.queue;
          }

          return JSON.stringify(prev) !== JSON.stringify(next) ? next : prev;
        });
        setSpotifyConnected(true);
        lastPlaybackEventAtRef.current = Date.now();
      }
    },
    onTokenExpired: () => {
      localStorage.removeItem('admin_token');
    },
    onSettingsUpdate: (data: { settings?: EventSettings }) => {
      if (data.settings) {
        setEventSettings((prev) =>
          JSON.stringify(prev) !== JSON.stringify(data.settings)
            ? (data.settings as EventSettings)
            : prev
        );
      }
    },
  });

  const handleTokenExpiration = useCallback(async (reason: string = 'expired') => {
    // Revoked sessions redirect once — never start refresh/token-expired loops.
    if (reason === 'session_revoked') {
      localStorage.removeItem('admin_token');
      return;
    }
    localStorage.removeItem('admin_token');
    try {
      await authenticatedFetch('/api/admin/token-expired', {
        method: 'POST',
        body: JSON.stringify({
          reason,
          message: 'Admin token has expired. Please log in again.',
        }),
      });
    } catch (pusherError) {
      console.error('Failed to trigger token expiration event:', pusherError);
    }
  }, []);

  const handleUnauthorized = useCallback(
    async (response: Response) => {
      if (await handleSessionRevokedResponse(response)) {
        await handleTokenExpiration('session_revoked');
        return;
      }
      await handleTokenExpiration('expired');
    },
    [handleTokenExpiration]
  );

  const refreshRequests = useCallback(async () => {
    const gen = ++requestsGenRef.current;
    try {
      const response = await authenticatedFetch('/api/admin/requests', {
        credentials: 'include',
      });
      if (gen !== requestsGenRef.current) return;
      if (response.ok) {
        const data = await response.json();
        const requestsArray = data.requests || data;
        setRequests((prev) =>
          JSON.stringify(prev) !== JSON.stringify(requestsArray)
            ? requestsArray
            : prev
        );
      } else if (response.status === 401) {
        await handleUnauthorized(response);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  }, [handleUnauthorized]);

  const patchPlaybackState = useCallback((patch: Partial<PlaybackState>) => {
    setPlaybackState((prev) => {
      if (!prev) {
        return {
          spotify_connected: false,
          is_playing: false,
          ...patch,
        };
      }
      return { ...prev, ...patch };
    });
    if (patch.spotify_connected === true) {
      setSpotifyConnected(true);
    } else if (patch.spotify_connected === false) {
      setSpotifyConnected(false, true);
    }
    if (patch.track_name) {
      hasConfirmedTrackRef.current = true;
    }
  }, [setSpotifyConnected]);

  const scheduleHydrateRetries = useCallback(() => {
    hydrateRetryTimersRef.current.forEach(clearTimeout);
    hydrateRetryTimersRef.current = [];
    for (const delay of HYDRATE_RETRY_DELAYS_MS) {
      const timer = setTimeout(() => {
        if (!hasConfirmedTrackRef.current && !confirmedDisconnectedRef.current) {
          void refreshPlaybackStateRef.current();
        }
      }, delay);
      hydrateRetryTimersRef.current.push(timer);
    }
  }, []);

  const refreshPlaybackState = useCallback(async () => {
    const gen = ++playbackGenRef.current;
    try {
      const response = await authenticatedFetch('/api/admin/queue/details', {
        credentials: 'include',
      });
      if (gen !== playbackGenRef.current) return;
      if (response.ok) {
        const data = await response.json();
        const connected = Boolean(data.spotify_connected);
        const incomingTrack = data.current_track;
        const playbackPending = Boolean(data.playback_pending);
        const reorderLocked = Date.now() < queueReorderLockUntilRef.current;

        if (connected) {
          setSpotifyConnected(true);
        } else if (hasConfirmedTrackRef.current) {
          // Debounce wipe when we previously had a track
          setSpotifyConnected(false);
        } else {
          setSpotifyConnected(false);
        }

        setPlaybackState((prev) => {
          // Unconfirmed empty first load: keep prior null/empty and let retries fill in
          if (
            connected &&
            !incomingTrack &&
            !prev?.track_name &&
            (playbackPending || !hasConfirmedTrackRef.current)
          ) {
            if (!prev) {
              return {
                spotify_connected: true,
                is_playing: false,
              };
            }
            return {
              ...prev,
              spotify_connected: true,
            };
          }

          if (connected && !incomingTrack && prev?.track_name) {
            const preserved: PlaybackState = {
              ...prev,
              spotify_connected: true,
              device_name: prev.device_name ?? data.device?.name,
              volume_percent:
                typeof data.device?.volume_percent === 'number'
                  ? data.device.volume_percent
                  : prev.volume_percent,
              queue:
                Array.isArray(data.queue) && data.queue.length > 0
                  ? data.queue
                  : prev.queue || [],
              is_playing: prev.is_playing,
            };
            return JSON.stringify(prev) !== JSON.stringify(preserved)
              ? preserved
              : prev;
          }

          // Single disconnected blip: keep track until debounce confirms
          if (!connected && prev?.track_name && !confirmedDisconnectedRef.current) {
            return {
              ...prev,
              spotify_connected: prev.spotify_connected,
            };
          }

          let nextQueue: QueueTrack[] = data.queue || [];
          if (reorderLocked && prev?.queue) {
            nextQueue = prev.queue;
          } else if (
            connected &&
            Array.isArray(data.queue) &&
            data.queue.length === 0 &&
            prev?.queue &&
            prev.queue.length > 0 &&
            !incomingTrack
          ) {
            nextQueue = prev.queue;
          }

          const newPlaybackState: PlaybackState = {
            spotify_connected: connected || Boolean(prev?.spotify_connected),
            is_playing: Boolean(data.is_playing),
            track_name: incomingTrack?.name,
            artist_name: incomingTrack
              ? formatArtists(incomingTrack.artists ?? null)
              : undefined,
            album_name: incomingTrack?.album,
            duration_ms: incomingTrack?.duration_ms,
            progress_ms: incomingTrack?.progress_ms,
            image_url: incomingTrack?.image_url,
            device_name: data.device?.name ?? prev?.device_name,
            volume_percent: data.device?.volume_percent ?? prev?.volume_percent,
            queue: nextQueue,
            timestamp: Date.now(),
          };

          if (incomingTrack?.name) {
            hasConfirmedTrackRef.current = true;
          }

          return JSON.stringify(prev) !== JSON.stringify(newPlaybackState)
            ? newPlaybackState
            : prev;
        });

        if (connected && incomingTrack) {
          lastPlaybackEventAtRef.current = Date.now();
        }

        if (connected && !incomingTrack && !hasConfirmedTrackRef.current) {
          scheduleHydrateRetries();
        }
      } else if (response.status === 401) {
        await handleUnauthorized(response);
      }
    } catch (error) {
      console.error('Failed to fetch playback state:', error);
    }
  }, [handleUnauthorized, scheduleHydrateRetries, setSpotifyConnected]);

  const refreshEventSettings = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/admin/event-settings', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setEventSettings((prev) =>
          JSON.stringify(prev) !== JSON.stringify(data) ? data : prev
        );
      } else if (response.status === 401) {
        await handleUnauthorized(response);
      }
    } catch (error) {
      console.error('Failed to fetch event settings:', error);
    }
  }, [handleUnauthorized]);

  const refreshStats = useCallback(async () => {
    const gen = ++statsGenRef.current;
    try {
      const response = await authenticatedFetch('/api/admin/stats', {
        credentials: 'include',
      });
      if (gen !== statsGenRef.current) return;
      if (response.ok) {
        const data = await response.json();
        setStats((prev) => {
          const next = {
            ...data,
            spotify_connected:
              typeof data.spotify_connected === 'boolean'
                ? data.spotify_connected
                : (prev?.spotify_connected ?? false),
          };
          return JSON.stringify(prev) !== JSON.stringify(next) ? next : prev;
        });
        if (typeof data.spotify_connected === 'boolean') {
          setSpotifyConnected(data.spotify_connected);
        }
      } else if (response.status === 401) {
        await handleUnauthorized(response);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [handleUnauthorized, setSpotifyConnected]);

  refreshRequestsRef.current = refreshRequests;
  refreshStatsRef.current = refreshStats;
  refreshPlaybackStateRef.current = refreshPlaybackState;
  refreshEventSettingsRef.current = refreshEventSettings;

  // Soft refresh: never toggle loading after first paint (avoids remounting children)
  const refreshData = useCallback(async () => {
    if (!hasInitialLoad) {
      setLoading(true);
    }
    try {
      await Promise.all([
        refreshRequests(),
        refreshPlaybackState(),
        refreshEventSettings(),
        refreshStats(),
      ]);
    } finally {
      setLoading(false);
      setHasInitialLoad(true);
    }
  }, [
    hasInitialLoad,
    refreshRequests,
    refreshPlaybackState,
    refreshEventSettings,
    refreshStats,
  ]);

  const handlePlaybackControl = useCallback(
    async (action: string) => {
      try {
        const response = await authenticatedFetch(`/api/admin/playback/${action}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (response.ok) {
          setTimeout(() => void refreshPlaybackState(), 1000);
        }
      } catch (error) {
        console.error(`Failed to ${action} playback:`, error);
      }
    },
    [refreshPlaybackState]
  );

  const updateEventSettings = useCallback(
    async (settings: Partial<EventSettings>) => {
      try {
        const response = await authenticatedFetch('/api/admin/event-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(settings),
        });

        if (response.ok) {
          await refreshEventSettings();
          return;
        }

        const errorText = await response.text();
        let message = 'Failed to update event settings';
        try {
          const parsed = JSON.parse(errorText) as {
            error?: string;
            detail?: string;
          };
          message = parsed.detail || parsed.error || message;
        } catch {
          if (errorText) message = errorText;
        }
        throw new Error(message);
      } catch (error) {
        console.error('Failed to update event settings:', error);
        throw error;
      }
    },
    [refreshEventSettings]
  );

  const handleSpotifyDisconnect = useCallback(async () => {
    try {
      setSpotifyConnected(false, true);
      await Promise.all([refreshPlaybackState(), refreshStats()]);
    } catch (error) {
      console.error('Failed to refresh data after disconnect:', error);
    }
  }, [refreshPlaybackState, refreshStats, setSpotifyConnected]);

  // Mount-once init. Do NOT depend on refresh* identities — when those callbacks
  // change, a re-run was setting loading=true again while an in-flight init could
  // hang, leaving the admin shell stuck on "Loading admin data..." forever
  // (playback sidebar could already show data from a partial prior fetch).
  useEffect(() => {
    const initGen = ++adminInitGenRef.current;
    const INIT_TIMEOUT_MS = 8_000;

    const withTimeout = async (work: Promise<void>, label: string) => {
      try {
        await Promise.race([
          work,
          new Promise<void>((_, reject) => {
            setTimeout(
              () => reject(new Error(`Admin init ${label} timed out`)),
              INIT_TIMEOUT_MS
            );
          }),
        ]);
      } catch (error) {
        console.error(error);
      }
    };

    const initializeAdmin = async () => {
      setLoading(true);
      try {
        await Promise.all([
          withTimeout(refreshRequestsRef.current(), 'requests'),
          withTimeout(refreshPlaybackStateRef.current(), 'playback'),
          withTimeout(refreshEventSettingsRef.current(), 'settings'),
          withTimeout(refreshStatsRef.current(), 'stats'),
        ]);
      } finally {
        // Only the latest init generation may clear the gate (Strict Mode safe).
        if (adminInitGenRef.current === initGen) {
          setLoading(false);
          setHasInitialLoad(true);
        }
      }

      if (adminInitGenRef.current !== initGen) return;

      // Fire-and-forget — must not keep the admin shell gated
      void authenticatedFetch('/api/admin/spotify-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'tick',
          force: true,
        }),
      })
        .then(() => {
          lastPlaybackEventAtRef.current = Date.now();
        })
        .catch((error) => {
          console.error('Failed to run Spotify sync tick:', error);
        });
    };

    void initializeAdmin();

    return () => {
      // Invalidate this generation so a superseded Strict Mode run cannot stick loading
      adminInitGenRef.current += 1;
      hydrateRetryTimersRef.current.forEach(clearTimeout);
      if (playbackPollRef.current) clearInterval(playbackPollRef.current);
      if (disconnectedDebounceRef.current) {
        clearTimeout(disconnectedDebounceRef.current);
      }
      // Do not stop global sync — ticks are request-driven and shared with displays.
    };
  }, []);

  const requestAdminPlaybackSync = useCallback(async (force = false) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    lastSyncAttemptAtRef.current = Date.now();
    try {
      await authenticatedFetch('/api/admin/spotify-watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'tick',
          force,
        }),
      });
    } catch (error) {
      console.error('Admin playback sync tick failed:', error);
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  // Light poll until first confirmed track, then staleness-gated ticks (Pusher + coalesce).
  useEffect(() => {
    if (playbackPollRef.current) {
      clearInterval(playbackPollRef.current);
      playbackPollRef.current = null;
    }

    playbackPollRef.current = setInterval(() => {
      if (confirmedDisconnectedRef.current) {
        return;
      }

      if (!hasConfirmedTrackRef.current) {
        void refreshPlaybackState();
        return;
      }

      const now = Date.now();
      const eventAge = now - lastPlaybackEventAtRef.current;
      const attemptAge = now - lastSyncAttemptAtRef.current;
      if (eventAge >= PLAYBACK_STALE_MS && attemptAge >= 4_000) {
        void requestAdminPlaybackSync(false);
      }
    }, hasConfirmedTrackRef.current ? PLAYBACK_STALE_CHECK_MS : PLAYBACK_POLL_UNTIL_TRACK_MS);

    return () => {
      if (playbackPollRef.current) {
        clearInterval(playbackPollRef.current);
        playbackPollRef.current = null;
      }
    };
  }, [playbackState?.track_name, spotifyConnected, refreshPlaybackState, requestAdminPlaybackSync]);

  // Resume reconcile when admin tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshPlaybackState();
      void requestAdminPlaybackSync(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refreshPlaybackState, requestAdminPlaybackSync]);

  const handleApprove = useCallback(
    async (id: string, playNext?: boolean) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'approved' as const,
                approved_at: new Date().toISOString(),
              }
            : r
        )
      );
      try {
        const response = await authenticatedFetch(`/api/admin/approve/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            add_to_queue: true,
            add_to_playlist: false,
            play_next: playNext || false,
          }),
        });
        if (response.ok) {
          await refreshRequests();
          await refreshStats();
        } else {
          await refreshRequests();
        }
      } catch (error) {
        console.error(`Error approving request ${id}:`, error);
        await refreshRequests();
      }
    },
    [refreshRequests, refreshStats]
  );

  const handleReject = useCallback(
    async (id: string, reason?: string) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'rejected' as const } : r
        )
      );
      try {
        const response = await authenticatedFetch(`/api/admin/reject/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            reason: reason || 'Rejected by admin',
          }),
        });
        if (response.ok) {
          await refreshRequests();
          await refreshStats();
        } else {
          await refreshRequests();
        }
      } catch (error) {
        console.error(`Error rejecting request ${id}:`, error);
        await refreshRequests();
      }
    },
    [refreshRequests, refreshStats]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      try {
        const response = await authenticatedFetch(`/api/admin/delete/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (response.ok) {
          await refreshRequests();
          await refreshStats();
        } else {
          await refreshRequests();
        }
      } catch (error) {
        console.error(`Error deleting request ${id}:`, error);
        await refreshRequests();
      }
    },
    [refreshRequests, refreshStats]
  );

  const handlePlayAgain = useCallback(
    async (id: string, playNext?: boolean) => {
      try {
        const response = await authenticatedFetch(`/api/admin/play-again/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            play_next: playNext || false,
          }),
        });
        if (response.ok) {
          await refreshRequests();
          await refreshStats();
        }
      } catch (error) {
        console.error(`Error playing again request ${id}:`, error);
      }
    },
    [refreshRequests, refreshStats]
  );

  const handleQueueReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      queueReorderLockUntilRef.current = Date.now() + QUEUE_REORDER_LOCK_MS;
      try {
        setPlaybackState((prev) => {
          if (!prev?.queue) return prev;
          const newQueue = [...prev.queue];
          const [movedItem] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, movedItem);
          return { ...prev, queue: newQueue };
        });

        const response = await authenticatedFetch('/api/admin/queue/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fromIndex, toIndex }),
        });

        if (!response.ok) {
          queueReorderLockUntilRef.current = 0;
          await refreshPlaybackState();
        }
      } catch (error) {
        console.error('Error reordering queue:', error);
        queueReorderLockUntilRef.current = 0;
        await refreshPlaybackState();
      }
    },
    [refreshPlaybackState]
  );

  const value: AdminDataContextType = {
    requests,
    playbackState,
    eventSettings,
    stats,
    loading,
    spotifyConnected,
    setSpotifyConnected,
    isConnected,
    connectionState,
    handlePlaybackControl,
    refreshData,
    refreshPlaybackState,
    patchPlaybackState,
    updateEventSettings,
    handleSpotifyDisconnect,
    handleApprove,
    handleReject,
    handleDelete,
    handlePlayAgain,
    handleQueueReorder,
  };

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
}
