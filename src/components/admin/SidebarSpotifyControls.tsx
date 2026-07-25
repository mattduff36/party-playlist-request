'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { formatArtists } from '@/lib/format-artists';
import { getSpotifyDeviceIcon } from '@/lib/spotify-device-icon';
import {
  clearSpotifyOAuthPending,
  markSpotifyOAuthPending,
} from '@/lib/spotify-oauth-client';

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface SidebarSpotifyControlsProps {
  /** sidebar = compact left-rail; page = single combined card for /spotify */
  variant?: 'sidebar' | 'page';
  onConnectionChange?: (connected: boolean) => void;
}

export default function SidebarSpotifyControls({
  variant = 'sidebar',
  onConnectionChange,
}: SidebarSpotifyControlsProps) {
  const {
    playbackState,
    handleSpotifyDisconnect,
    refreshPlaybackState,
    patchPlaybackState,
  } = useAdminData();

  const isPage = variant === 'page';

  const [connected, setConnected] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [volume, setVolume] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        setConnected(false);
        setHasResolved(true);
        onConnectionChange?.(false);
        return false;
      }

      const isConnected = Boolean(data.connected);
      setConnected(isConnected);
      setHasResolved(true);
      onConnectionChange?.(isConnected);

      if (isConnected && data.device?.volume_percent !== undefined) {
        setVolume(data.device.volume_percent);
      }

      return isConnected;
    } catch {
      setConnected(false);
      setHasResolved(true);
      onConnectionChange?.(false);
      return false;
    }
  }, [onConnectionChange]);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/devices', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setDevices(data.devices || []);
    } catch {
      // ignore — devices are best-effort
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchDevices();
    const interval = setInterval(() => {
      void fetchStatus();
      void fetchDevices();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchStatus]);

  useEffect(() => {
    if (
      typeof playbackState?.volume_percent === 'number' &&
      playbackState.spotify_connected
    ) {
      setVolume(playbackState.volume_percent);
    }
    if (playbackState?.spotify_connected !== undefined) {
      setConnected(playbackState.spotify_connected);
      setHasResolved(true);
    }
  }, [playbackState?.spotify_connected, playbackState?.volume_percent]);

  const connectToSpotify = () => {
    markSpotifyOAuthPending();
    setIsStartingOAuth(true);
    window.location.href = '/api/spotify/auth';
  };

  const disconnectFromSpotify = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/spotify/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to disconnect');
        return;
      }
      clearSpotifyOAuthPending();
      setConnected(false);
      setDevices([]);
      onConnectionChange?.(false);
      await handleSpotifyDisconnect();
    } catch {
      setError('Network error disconnecting');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePlayPause = async () => {
    if (isPerformingAction) return;
    setIsPerformingAction(true);
    try {
      const endpoint = playbackState?.is_playing
        ? '/api/admin/playback/pause'
        : '/api/admin/playback/resume';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('playback toggle failed');
      setTimeout(() => {
        void refreshPlaybackState();
        void fetchStatus();
      }, 400);
    } catch {
      setError('Failed to toggle playback');
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleSkip = async (direction: 'next' | 'previous') => {
    if (isPerformingAction) return;
    setIsPerformingAction(true);
    try {
      const endpoint =
        direction === 'next'
          ? '/api/admin/playback/skip'
          : '/api/admin/playback/previous';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('skip failed');
      setTimeout(() => {
        void refreshPlaybackState();
        void fetchStatus();
      }, 400);
    } catch {
      setError(direction === 'next' ? 'Failed to skip' : 'Failed to go previous');
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    try {
      const response = await fetch('/api/admin/playback/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ volume: newVolume }),
      });
      if (!response.ok) throw new Error('volume failed');
    } catch {
      setError('Failed to set volume');
    }
  };

  const handleDeviceChange = async (deviceId: string) => {
    const wasPlaying = Boolean(playbackState?.is_playing);
    const targetDevice = devices.find((device) => device.id === deviceId);

    try {
      const response = await fetch('/api/spotify/transfer-playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // Keep music going when switching devices while playing
        body: JSON.stringify({
          device_id: deviceId,
          play: wasPlaying,
        }),
      });
      if (!response.ok) throw new Error('transfer failed');

      // Optimistic UI: Spotify often returns empty playback briefly after transfer
      setDevices((prev) =>
        prev.map((device) => ({
          ...device,
          is_active: device.id === deviceId,
        }))
      );
      patchPlaybackState({
        device_name: targetDevice?.name ?? playbackState?.device_name,
        volume_percent:
          typeof targetDevice?.volume_percent === 'number'
            ? targetDevice.volume_percent
            : playbackState?.volume_percent,
        is_playing: wasPlaying || Boolean(playbackState?.is_playing),
      });
      if (typeof targetDevice?.volume_percent === 'number') {
        setVolume(targetDevice.volume_percent);
      }

      // Retry refresh until Spotify reports the track again on the new device
      const retryDelaysMs = [600, 1500, 3000];
      for (const delayMs of retryDelaysMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await fetchDevices();
        await fetchStatus();
        await refreshPlaybackState();
      }
    } catch {
      setError('Failed to transfer playback');
      void fetchDevices();
      void refreshPlaybackState();
    }
  };

  const trackName = playbackState?.track_name;
  const artistName = formatArtists(playbackState?.artist_name ?? null);
  const isPlaying = Boolean(playbackState?.is_playing);

  const shellClass = isPage
    ? 'bg-elevated rounded-lg border border-white/10 p-5 space-y-5'
    : 'flex flex-col gap-3 px-3 py-3';

  if (!hasResolved || isStartingOAuth) {
    return (
      <div
        className={
          isPage
            ? 'bg-elevated rounded-lg border border-white/10 p-8 flex flex-col items-center justify-center gap-2'
            : 'flex flex-col items-center justify-center gap-2 px-3 py-6 text-center'
        }
      >
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
        <p className="text-xs text-muted">
          {isStartingOAuth ? 'Connecting to Spotify...' : 'Checking Spotify...'}
        </p>
      </div>
    );
  }

  const connectedRow = (
    <div
      className={
        isPage
          ? 'flex flex-wrap items-center gap-3'
          : 'flex items-center gap-2'
      }
    >
      <div
        className={`flex items-center gap-2 rounded-lg bg-surface border border-white/10 min-w-0 ${
          isPage ? 'flex-1 min-w-[12rem] px-3 py-2' : 'flex-1 px-2 py-1.5'
        }`}
      >
        <CheckCircle
          className={`${isPage ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-accent flex-shrink-0`}
        />
        <p
          className={`${isPage ? 'text-sm' : 'text-xs'} font-medium text-bone truncate`}
        >
          Connected
        </p>
      </div>
      <button
        type="button"
        onClick={() => void disconnectFromSpotify()}
        disabled={isBusy}
        className={`${
          isPage ? 'px-3 py-2 text-xs' : 'shrink-0 text-[11px] px-2 py-1.5'
        } rounded-lg border border-red-500/40 text-red-400/90 hover:bg-red-900/20 transition-colors disabled:opacity-50`}
      >
        {isBusy ? 'Disconnecting...' : 'Disconnect'}
      </button>
    </div>
  );

  const disconnectedBlock = (
    <div className={isPage ? 'space-y-3' : 'space-y-2'}>
      <div
        className={`flex items-center gap-2 rounded-lg bg-surface border border-white/10 ${
          isPage ? 'px-3 py-2' : 'px-2 py-1.5'
        }`}
      >
        <WifiOff
          className={`${isPage ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-muted flex-shrink-0`}
        />
        <p className={`${isPage ? 'text-sm' : 'text-xs'} text-muted`}>
          Not connected
        </p>
      </div>
      <button
        type="button"
        onClick={connectToSpotify}
        className={`w-full flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-ink font-medium rounded-lg transition-colors ${
          isPage ? 'px-4 py-2.5 text-sm' : 'px-2 py-2 text-xs'
        }`}
      >
        <Music className={isPage ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        <span>Connect to Spotify</span>
        <ExternalLink className={isPage ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      </button>
    </div>
  );

  return (
    <div className={shellClass}>
      {isPage && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-bone">Playback Controls</h2>
          {connected && playbackState?.device_name && (
            <p className="text-xs text-muted truncate">
              {playbackState.device_name}
            </p>
          )}
        </div>
      )}

      {/* Page: connection at top. Sidebar: connection moved to bottom. */}
      {isPage && (connected ? connectedRow : disconnectedBlock)}
      {!isPage && !connected && disconnectedBlock}

      {connected && (
        <div
          className={
            isPage
              ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5'
              : 'contents'
          }
        >
          {/* Now Playing + transport + volume */}
          <div className={isPage ? 'space-y-4' : 'contents'}>
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSkip('previous')}
                  disabled={isPerformingAction}
                  className={`${
                    isPage ? 'p-2.5' : 'p-2'
                  } rounded-lg text-muted hover:text-bone hover:bg-surface disabled:opacity-50`}
                  title="Previous"
                >
                  <SkipBack className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => void handlePlayPause()}
                  disabled={isPerformingAction}
                  className={`${
                    isPage ? 'p-3.5' : 'p-3'
                  } rounded-full bg-accent hover:bg-accent-hover text-ink disabled:opacity-50 shadow-md`}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className={isPage ? 'w-7 h-7' : 'w-6 h-6'} />
                  ) : (
                    <Play className={isPage ? 'w-7 h-7' : 'w-6 h-6'} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSkip('next')}
                  disabled={isPerformingAction}
                  className={`${
                    isPage ? 'p-2.5' : 'p-2'
                  } rounded-lg text-muted hover:text-bone hover:bg-surface disabled:opacity-50`}
                  title="Next"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>

              {trackName ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`${
                      isPage ? 'w-16 h-16' : 'w-10 h-10'
                    } rounded bg-surface flex-shrink-0 overflow-hidden flex items-center justify-center`}
                  >
                    {playbackState?.image_url ? (
                      <img
                        src={playbackState.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music
                        className={`${isPage ? 'w-6 h-6' : 'w-4 h-4'} text-muted`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`${
                        isPage ? 'text-base' : 'text-xs'
                      } font-medium truncate ${
                        isPlaying ? 'text-accent' : 'text-bone'
                      }`}
                    >
                      {trackName}
                    </p>
                    <p
                      className={`${
                        isPage ? 'text-sm' : 'text-[10px]'
                      } text-muted truncate`}
                    >
                      {artistName}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={`${isPage ? 'text-sm' : 'text-xs'} text-muted text-center`}>
                  Nothing playing
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleVolumeChange(0)}
                  className="p-1 text-muted hover:text-bone"
                  title="Mute"
                >
                  <VolumeX className={isPage ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(event) =>
                    void handleVolumeChange(Number(event.target.value))
                  }
                  className="flex-1 h-1 accent-accent cursor-pointer"
                  aria-label="Volume"
                />
                <button
                  type="button"
                  onClick={() => void handleVolumeChange(100)}
                  className="p-1 text-muted hover:text-bone"
                  title="Max volume"
                >
                  <Volume2 className={isPage ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                </button>
                <span
                  className={`${
                    isPage ? 'text-xs w-9' : 'text-[10px] w-7'
                  } text-muted text-right tabular-nums`}
                >
                  {volume}%
                </span>
              </div>
            </div>
          </div>

          {/* Devices */}
          <div>
            {isPage && (
              <h3 className="text-xs font-semibold text-muted mb-2">
                Available devices
              </h3>
            )}
            {devices.length > 0 ? (
              <div className="space-y-1">
                {devices.map((device) => {
                  const DeviceIcon = getSpotifyDeviceIcon(device.type);
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => void handleDeviceChange(device.id)}
                      className={`w-full flex items-center gap-2 rounded-lg text-left transition-colors ${
                        isPage ? 'px-3 py-2' : 'px-2 py-1.5'
                      } ${
                        device.is_active
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-surface text-muted hover:text-bone border border-transparent'
                      }`}
                    >
                      <DeviceIcon
                        className={`${isPage ? 'w-4 h-4' : 'w-3.5 h-3.5'} flex-shrink-0`}
                      />
                      <span
                        className={`${
                          isPage ? 'text-sm' : 'text-[11px]'
                        } truncate flex-1`}
                      >
                        {device.name}
                      </span>
                      {device.is_active && (
                        <span className="text-[9px] uppercase tracking-wide">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={`${isPage ? 'text-sm' : 'text-xs'} text-muted`}>
                No devices found. Open Spotify on a device.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sidebar: Connected + Disconnect on one line at the bottom */}
      {!isPage && connected && connectedRow}

      {error && (
        <p
          className={`${
            isPage ? 'text-sm' : 'text-[11px]'
          } text-red-400 bg-red-900/20 border border-red-600/50 rounded-lg px-2 py-1.5`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
