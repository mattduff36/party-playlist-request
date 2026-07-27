'use client';

/**
 * Shared Spotify playback-control state for sidebar + /spotify page.
 * Both SidebarSpotifyControls instances read the same devices/volume/connection
 * so the UI stays in sync.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminData } from '@/contexts/AdminDataContext';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface TransferLock {
  deviceId: string;
  deviceName: string;
  wasPlaying: boolean;
  until: number;
}

interface SpotifyControlsContextType {
  hasResolved: boolean;
  devices: SpotifyDevice[];
  devicesHydrated: boolean;
  devicesRefreshing: boolean;
  volume: number;
  error: string | null;
  setError: (error: string | null) => void;
  getActiveDeviceId: () => string | undefined;
  fetchStatus: () => Promise<boolean>;
  fetchDevices: () => Promise<void>;
  handleVolumeChange: (newVolume: number) => Promise<void>;
  handleDeviceChange: (deviceId: string) => Promise<void>;
  clearDevicesOnDisconnect: () => void;
  registerConnectionListener: (
    listener: ((connected: boolean) => void) | undefined
  ) => () => void;
}

const EMPTY_CONFIRM_MS = 2500;
const EMPTY_CONFIRM_STREAK = 2;

/** Sticky banner copy from playback routes when Spotify returns NO_ACTIVE_DEVICE. */
function isNoActiveDeviceError(message: string | null | undefined): boolean {
  return Boolean(
    message && message.includes('No active Spotify device found')
  );
}

function devicesStorageKey(username: string | undefined): string {
  return `ppr_spotify_devices_${username || 'default'}`;
}

function readStoredDevices(username: string | undefined): SpotifyDevice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(devicesStorageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredDevices(
  username: string | undefined,
  devices: SpotifyDevice[]
): void {
  if (typeof window === 'undefined') return;
  try {
    if (devices.length === 0) {
      sessionStorage.removeItem(devicesStorageKey(username));
    } else {
      sessionStorage.setItem(
        devicesStorageKey(username),
        JSON.stringify(devices)
      );
    }
  } catch {
    // ignore
  }
}

const SpotifyControlsContext =
  createContext<SpotifyControlsContextType | null>(null);

export function SpotifyControlsProvider({ children }: { children: ReactNode }) {
  const { token } = useAdminAuth();
  const params = useParams();
  const username = useMemo(() => {
    const fromPath = typeof params?.username === 'string' ? params.username : '';
    if (fromPath) return fromPath;
    if (!token) return 'default';
    try {
      const decoded = jwtDecode<{ username?: string }>(token);
      return decoded.username || 'default';
    } catch {
      return 'default';
    }
  }, [params?.username, token]);

  const {
    playbackState,
    spotifyConnected,
    setSpotifyConnected,
    refreshPlaybackState,
    patchPlaybackState,
  } = useAdminData();

  const [hasResolved, setHasResolved] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>(() =>
    readStoredDevices(
      typeof window !== 'undefined'
        ? window.location.pathname.split('/').filter(Boolean)[0]
        : 'default'
    )
  );
  const [devicesHydrated, setDevicesHydrated] = useState(false);
  const [devicesRefreshing, setDevicesRefreshing] = useState(false);
  const [volume, setVolume] = useState(50);
  const [error, setError] = useState<string | null>(null);

  /** Clear only the stale NO_ACTIVE_DEVICE banner; leave auth/rate-limit/etc. alone. */
  const clearStaleNoActiveDeviceError = useCallback(() => {
    setError((prev) => (isNoActiveDeviceError(prev) ? null : prev));
  }, []);

  const devicesHydratedRef = useRef(false);
  const trackNameRef = useRef(playbackState?.track_name);
  trackNameRef.current = playbackState?.track_name;
  const deviceTransferLockRef = useRef<TransferLock | null>(null);
  const emptyStreakRef = useRef(0);
  const emptySinceRef = useRef<number | null>(null);
  const emptyConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const connectionListenersRef = useRef(
    new Set<(connected: boolean) => void>()
  );
  const lastNotifiedConnectedRef = useRef<boolean | null>(null);
  const volumeUserLockUntilRef = useRef(0);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchStatusRef = useRef<() => Promise<boolean>>(async () => false);
  const fetchDevicesRef = useRef<() => Promise<void>>(async () => {});

  const notifyConnection = useCallback((connected: boolean) => {
    if (lastNotifiedConnectedRef.current === connected) return;
    lastNotifiedConnectedRef.current = connected;
    connectionListenersRef.current.forEach((listener) => listener(connected));
  }, []);

  const registerConnectionListener = useCallback(
    (listener: ((connected: boolean) => void) | undefined) => {
      if (!listener) return () => {};
      connectionListenersRef.current.add(listener);
      return () => {
        connectionListenersRef.current.delete(listener);
      };
    },
    []
  );

  const clearEmptyConfirm = useCallback(() => {
    emptyStreakRef.current = 0;
    emptySinceRef.current = null;
    if (emptyConfirmTimeoutRef.current) {
      clearTimeout(emptyConfirmTimeoutRef.current);
      emptyConfirmTimeoutRef.current = null;
    }
  }, []);

  const applyConnectedTrue = useCallback(() => {
    setSpotifyConnected(true);
    setHasResolved(true);
    notifyConnection(true);
  }, [notifyConnection, setSpotifyConnected]);

  const applyConnectedFalse = useCallback(
    (immediate = false) => {
      setHasResolved(true);
      setSpotifyConnected(false, immediate);
      if (immediate) {
        notifyConnection(false);
      }
    },
    [notifyConnection, setSpotifyConnected]
  );

  const getActiveDeviceId = useCallback((): string | undefined => {
    return devices.find((d) => d.is_active)?.id;
  }, [devices]);

  const applyLockToDevices = useCallback(
    (incoming: SpotifyDevice[], prev: SpotifyDevice[]): SpotifyDevice[] => {
      const lock = deviceTransferLockRef.current;
      const lockActive = Boolean(lock && Date.now() < lock.until);
      let next = incoming.map((device) => ({ ...device }));

      if (lock && lockActive) {
        const hasTarget = next.some((device) => device.id === lock.deviceId);
        if (!hasTarget) {
          const fromPrev = prev.find((device) => device.id === lock.deviceId);
          if (fromPrev) {
            next = [...next, { ...fromPrev }];
          }
        }
        next = next.map((device) => ({
          ...device,
          is_active: device.id === lock.deviceId,
        }));
        if (
          incoming.some(
            (device) => device.id === lock.deviceId && device.is_active
          )
        ) {
          deviceTransferLockRef.current = null;
        }
      }

      return next;
    },
    []
  );

  const scheduleEmptyClearIfConfirmed = useCallback(() => {
    const tryClear = () => {
      const lock = deviceTransferLockRef.current;
      if (lock && Date.now() < lock.until) return;
      const since = emptySinceRef.current;
      if (since === null) return;
      const elapsed = Date.now() - since;
      if (
        emptyStreakRef.current >= EMPTY_CONFIRM_STREAK &&
        elapsed >= EMPTY_CONFIRM_MS
      ) {
        clearEmptyConfirm();
        setDevices([]);
        writeStoredDevices(username, []);
      }
    };

    if (emptyConfirmTimeoutRef.current) {
      clearTimeout(emptyConfirmTimeoutRef.current);
      emptyConfirmTimeoutRef.current = null;
    }

    const since = emptySinceRef.current;
    if (since === null) return;
    const remaining = EMPTY_CONFIRM_MS - (Date.now() - since);
    if (emptyStreakRef.current >= EMPTY_CONFIRM_STREAK && remaining <= 0) {
      tryClear();
      return;
    }
    emptyConfirmTimeoutRef.current = setTimeout(
      tryClear,
      Math.max(remaining, 0)
    );
  }, [clearEmptyConfirm, username]);

  const applyDevices = useCallback(
    (incoming: SpotifyDevice[]) => {
      devicesHydratedRef.current = true;
      setDevicesHydrated(true);
      setDevicesRefreshing(false);

      if (incoming.length > 0) {
        clearEmptyConfirm();
        setDevices((prev) => {
          const next = applyLockToDevices(incoming, prev);
          writeStoredDevices(username, next);
          return next;
        });
        const lock = deviceTransferLockRef.current;
        const lockActive = Boolean(lock && Date.now() < lock.until);
        if (
          incoming.some((device) => device.is_active) ||
          lockActive
        ) {
          clearStaleNoActiveDeviceError();
        }
        return;
      }

      const lock = deviceTransferLockRef.current;
      const lockActive = Boolean(lock && Date.now() < lock.until);
      if (!lockActive) {
        emptyStreakRef.current += 1;
        if (emptySinceRef.current === null) {
          emptySinceRef.current = Date.now();
        }
        scheduleEmptyClearIfConfirmed();
      }

      setDevices((prev) => {
        if (prev.length === 0) return prev;
        return applyLockToDevices([], prev);
      });
    },
    [
      applyLockToDevices,
      clearEmptyConfirm,
      clearStaleNoActiveDeviceError,
      scheduleEmptyClearIfConfirmed,
      username,
    ]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        applyConnectedFalse();
        return false;
      }

      const isConnected = Boolean(data.connected);
      if (isConnected) {
        applyConnectedTrue();
      } else {
        applyConnectedFalse();
      }

      const lock = deviceTransferLockRef.current;
      const lockActive = Boolean(lock && Date.now() < lock.until);

      if (lockActive && lock) {
        patchPlaybackState({
          device_name: lock.deviceName,
          is_playing: lock.wasPlaying,
        });
      } else if (isConnected && data.device?.volume_percent !== undefined) {
        setVolume(data.device.volume_percent);
        patchPlaybackState({ volume_percent: data.device.volume_percent });
      }

      if (isConnected && data.current_track && !trackNameRef.current) {
        patchPlaybackState({
          spotify_connected: true,
          is_playing: Boolean(data.is_playing),
          track_name: data.current_track.name,
          artist_name: data.current_track.artist,
          album_name: data.current_track.album,
          image_url: data.current_track.image_url,
          duration_ms: data.current_track.duration_ms,
          progress_ms: data.current_track.progress_ms,
          device_name: data.device?.name,
          volume_percent: data.device?.volume_percent,
        });
      }

      // Status shows a live device / track — drop stale NO_ACTIVE_DEVICE banner
      if (isConnected && (data.device || data.current_track)) {
        clearStaleNoActiveDeviceError();
      }

      return isConnected;
    } catch {
      applyConnectedFalse();
      return false;
    }
  }, [
    applyConnectedFalse,
    applyConnectedTrue,
    clearStaleNoActiveDeviceError,
    patchPlaybackState,
  ]);

  const devicesBackoffUntilRef = useRef(0);

  const fetchDevices = useCallback(async () => {
    if (Date.now() < devicesBackoffUntilRef.current) {
      return;
    }
    if (!devicesHydratedRef.current) {
      setDevicesRefreshing(true);
    }
    try {
      const response = await fetch('/api/spotify/devices', {
        credentials: 'include',
      });
      if (!response.ok) {
        setDevicesRefreshing(false);
        if (response.status === 429) {
          const retryAfter = Number.parseInt(
            response.headers.get('Retry-After') || '',
            10
          );
          const waitMs = Number.isFinite(retryAfter)
            ? Math.min(Math.max(retryAfter, 1) * 1000, 60_000)
            : 60_000;
          devicesBackoffUntilRef.current = Date.now() + waitMs;
        }
        return;
      }
      devicesBackoffUntilRef.current = 0;
      const data = await response.json();
      applyDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch {
      setDevicesRefreshing(false);
    }
  }, [applyDevices]);

  fetchStatusRef.current = fetchStatus;
  fetchDevicesRef.current = fetchDevices;

  // Single poller for all control instances
  useEffect(() => {
    const stored = readStoredDevices(username);
    if (stored.length > 0) {
      setDevices(stored);
    }
    void fetchStatusRef.current();
    void fetchDevicesRef.current();
    const statusInterval = setInterval(() => {
      void fetchStatusRef.current();
    }, 10_000);
    const devicesInterval = setInterval(() => {
      void fetchDevicesRef.current();
    }, 30_000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(devicesInterval);
      if (emptyConfirmTimeoutRef.current) {
        clearTimeout(emptyConfirmTimeoutRef.current);
      }
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
    };
  }, [username]);

  useEffect(() => {
    if (devicesHydrated && devices.length === 0) {
      writeStoredDevices(username, []);
    }
  }, [devices.length, devicesHydrated, username]);

  // Keep device name stable during transfer; sync remote volume only when user is idle
  useEffect(() => {
    const lock = deviceTransferLockRef.current;
    const lockActive = Boolean(lock && Date.now() < lock.until);

    if (
      lockActive &&
      lock &&
      playbackState?.device_name &&
      playbackState.device_name !== lock.deviceName
    ) {
      patchPlaybackState({
        device_name: lock.deviceName,
        is_playing: lock.wasPlaying,
      });
      return;
    }

    if (
      !lockActive &&
      Date.now() >= volumeUserLockUntilRef.current &&
      typeof playbackState?.volume_percent === 'number' &&
      playbackState.spotify_connected
    ) {
      setVolume(playbackState.volume_percent);
    }
  }, [
    playbackState?.volume_percent,
    playbackState?.device_name,
    playbackState?.spotify_connected,
    patchPlaybackState,
  ]);

  // Notify page listeners only when connection truth changes (not on volume/device noise)
  useEffect(() => {
    if (spotifyConnected) {
      setHasResolved(true);
      notifyConnection(true);
    } else if (hasResolved) {
      notifyConnection(false);
    }
  }, [hasResolved, spotifyConnected, notifyConnection]);

  // Playback poll can recover after a failed play/pause while the banner still shows
  useEffect(() => {
    const hasActiveDevice = devices.some((device) => device.is_active);
    const hasPlaybackContext = Boolean(
      playbackState?.track_name || playbackState?.device_name
    );
    if (hasActiveDevice || hasPlaybackContext) {
      clearStaleNoActiveDeviceError();
    }
  }, [
    clearStaleNoActiveDeviceError,
    devices,
    playbackState?.device_name,
    playbackState?.track_name,
  ]);

  const handleVolumeChange = useCallback(
    async (newVolume: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newVolume)));
      // Hold off remote volume sync so polls/status don't yank the slider back
      volumeUserLockUntilRef.current = Date.now() + 2500;
      setVolume(clamped);
      patchPlaybackState({ volume_percent: clamped });
      setError(null);

      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      volumeDebounceRef.current = setTimeout(async () => {
        volumeDebounceRef.current = null;
        try {
          const deviceId = devices.find((d) => d.is_active)?.id;
          const response = await authenticatedFetch('/api/admin/playback/volume', {
            method: 'POST',
            body: JSON.stringify({
              volume: clamped,
              ...(deviceId ? { device_id: deviceId } : {}),
            }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(
              typeof data.error === 'string' ? data.error : 'volume failed'
            );
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to set volume');
        }
      }, 150);
    },
    [devices, patchPlaybackState]
  );

  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      if (
        deviceTransferLockRef.current &&
        Date.now() < deviceTransferLockRef.current.until
      ) {
        return;
      }

      const wasPlaying = Boolean(playbackState?.is_playing);
      const targetDevice = devices.find((device) => device.id === deviceId);
      if (!targetDevice || targetDevice.is_active) {
        return;
      }

      const lock: TransferLock = {
        deviceId,
        deviceName: targetDevice.name,
        wasPlaying,
        until: Date.now() + 8000,
      };
      deviceTransferLockRef.current = lock;

      applyDevices(
        devices.map((device) => ({
          ...device,
          is_active: device.id === deviceId,
        }))
      );
      patchPlaybackState({
        device_name: lock.deviceName,
        volume_percent:
          typeof targetDevice.volume_percent === 'number'
            ? targetDevice.volume_percent
            : playbackState?.volume_percent,
        is_playing: wasPlaying,
      });
      if (typeof targetDevice.volume_percent === 'number') {
        setVolume(targetDevice.volume_percent);
      }

      try {
        const response = await authenticatedFetch('/api/spotify/transfer-playback', {
          method: 'POST',
          body: JSON.stringify({
            device_id: deviceId,
            play: wasPlaying,
          }),
        });
        if (!response.ok) throw new Error('transfer failed');

        clearStaleNoActiveDeviceError();

        const retryDelaysMs = [800, 1800, 3200];
        for (const delayMs of retryDelaysMs) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (deviceTransferLockRef.current?.deviceId !== deviceId) break;
          await fetchDevices();
          await fetchStatus();
          await refreshPlaybackState();
          if (deviceTransferLockRef.current?.deviceId === deviceId) {
            patchPlaybackState({
              device_name: lock.deviceName,
              is_playing: wasPlaying,
            });
          }
        }
      } catch {
        deviceTransferLockRef.current = null;
        setError('Failed to transfer playback');
        void fetchDevices();
        void refreshPlaybackState();
      }
    },
    [
      applyDevices,
      clearStaleNoActiveDeviceError,
      devices,
      fetchDevices,
      fetchStatus,
      patchPlaybackState,
      playbackState?.is_playing,
      playbackState?.volume_percent,
      refreshPlaybackState,
    ]
  );

  const clearDevicesOnDisconnect = useCallback(() => {
    clearEmptyConfirm();
    applyConnectedFalse(true);
    setDevices([]);
    devicesHydratedRef.current = false;
    setDevicesHydrated(false);
    setDevicesRefreshing(false);
    writeStoredDevices(username, []);
  }, [applyConnectedFalse, clearEmptyConfirm, username]);

  const value: SpotifyControlsContextType = {
    hasResolved,
    devices,
    devicesHydrated,
    devicesRefreshing,
    volume,
    error,
    setError,
    getActiveDeviceId,
    fetchStatus,
    fetchDevices,
    handleVolumeChange,
    handleDeviceChange,
    clearDevicesOnDisconnect,
    registerConnectionListener,
  };

  return (
    <SpotifyControlsContext.Provider value={value}>
      {children}
    </SpotifyControlsContext.Provider>
  );
}

export function useSpotifyControls() {
  const context = useContext(SpotifyControlsContext);
  if (!context) {
    throw new Error(
      'useSpotifyControls must be used within a SpotifyControlsProvider'
    );
  }
  return context;
}
