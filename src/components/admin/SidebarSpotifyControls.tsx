'use client';

import { useEffect, useState } from 'react';
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
import { useSpotifyControls } from '@/contexts/SpotifyControlsContext';
import { formatArtists } from '@/lib/format-artists';
import { getSpotifyDeviceIcon } from '@/lib/spotify-device-icon';
import {
  clearSpotifyOAuthPending,
  markSpotifyOAuthPending,
} from '@/lib/spotify-oauth-client';

interface SidebarSpotifyControlsProps {
  /** sidebar = compact left-rail; page = single combined card for /spotify */
  variant?: 'sidebar' | 'page';
  onConnectionChange?: (connected: boolean) => void;
}

function formatTrackTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function SidebarSpotifyControls({
  variant = 'sidebar',
  onConnectionChange,
}: SidebarSpotifyControlsProps) {
  const {
    playbackState,
    spotifyConnected,
    handleSpotifyDisconnect,
    refreshPlaybackState,
  } = useAdminData();

  const {
    hasResolved,
    devices,
    devicesHydrated,
    devicesRefreshing,
    volume,
    error,
    setError,
    getActiveDeviceId,
    fetchStatus,
    handleVolumeChange,
    handleDeviceChange,
    clearDevicesOnDisconnect,
    registerConnectionListener,
  } = useSpotifyControls();

  const isPage = variant === 'page';
  const connected = spotifyConnected;

  const [isBusy, setIsBusy] = useState(false);
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [displayProgressMs, setDisplayProgressMs] = useState(0);

  useEffect(() => {
    return registerConnectionListener(onConnectionChange);
  }, [onConnectionChange, registerConnectionListener]);

  const durationMs = playbackState?.duration_ms ?? 0;
  const trackKey = `${playbackState?.track_name ?? ''}|${durationMs}`;

  useEffect(() => {
    setDisplayProgressMs(playbackState?.progress_ms ?? 0);
  }, [playbackState?.progress_ms, trackKey]);

  useEffect(() => {
    if (!playbackState?.is_playing || durationMs <= 0) return;
    const id = setInterval(() => {
      setDisplayProgressMs((prev) => Math.min(prev + 1000, durationMs));
    }, 1000);
    return () => clearInterval(id);
  }, [playbackState?.is_playing, durationMs, trackKey]);

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
      clearDevicesOnDisconnect();
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
    setError(null);
    try {
      const endpoint = playbackState?.is_playing
        ? '/api/admin/playback/pause'
        : '/api/admin/playback/resume';
      const deviceId = getActiveDeviceId();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(deviceId ? { device_id: deviceId } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === 'string' ? data.error : 'playback toggle failed'
        );
      }
      setTimeout(() => {
        void refreshPlaybackState();
        void fetchStatus();
      }, 400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to toggle playback'
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleSkip = async (direction: 'next' | 'previous') => {
    if (isPerformingAction) return;
    setIsPerformingAction(true);
    setError(null);
    try {
      const endpoint =
        direction === 'next'
          ? '/api/admin/playback/skip'
          : '/api/admin/playback/previous';
      const deviceId = getActiveDeviceId();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(deviceId ? { device_id: deviceId } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : direction === 'next'
              ? 'Failed to skip'
              : 'Failed to go previous'
        );
      }
      setTimeout(() => {
        void refreshPlaybackState();
        void fetchStatus();
      }, 400);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : direction === 'next'
            ? 'Failed to skip'
            : 'Failed to go previous'
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  const trackName = playbackState?.track_name;
  const artistName = formatArtists(playbackState?.artist_name ?? null);
  const isPlaying = Boolean(playbackState?.is_playing);
  const progressPercent =
    durationMs > 0
      ? Math.min(100, Math.max(0, (displayProgressMs / durationMs) * 100))
      : 0;

  const shellClass = isPage
    ? 'bg-elevated rounded-lg border border-white/10 p-5 space-y-5'
    : 'flex flex-col gap-4 px-3 py-4';

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

  const connectedChip = (
    <div className="flex items-center gap-2 shrink-0">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent">
        <CheckCircle className="w-3.5 h-3.5" />
        Connected
      </span>
      <button
        type="button"
        onClick={() => void disconnectFromSpotify()}
        disabled={isBusy}
        className="shrink-0 rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-400/90 hover:bg-red-900/20 transition-colors disabled:opacity-50"
      >
        {isBusy ? 'Disconnecting...' : 'Disconnect'}
      </button>
    </div>
  );

  const sidebarConnectedRow = (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-lg bg-surface border border-white/10 px-2 py-1.5 min-w-0">
        <CheckCircle className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <p className="text-xs font-medium text-bone truncate">Connected</p>
      </div>
      <button
        type="button"
        onClick={() => void disconnectFromSpotify()}
        disabled={isBusy}
        className="shrink-0 text-[11px] px-2 py-1.5 rounded-lg border border-red-500/40 text-red-400/90 hover:bg-red-900/20 transition-colors disabled:opacity-50"
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

  const nowPlayingBlock = trackName ? (
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
          className={`${isPage ? 'text-base' : 'text-xs'} font-medium truncate ${
            isPlaying ? 'text-accent' : 'text-bone'
          }`}
        >
          {trackName}
        </p>
        <p
          className={`${isPage ? 'text-sm' : 'text-[10px]'} text-muted truncate`}
        >
          {artistName}
        </p>
      </div>
    </div>
  ) : (
    <p className={`${isPage ? 'text-sm' : 'text-xs'} text-muted`}>
      Nothing playing
    </p>
  );

  const volumeBlock = (
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
  );

  // ~3 device rows visible; 4+ scrolls. Heights match sidebar/page skeleton rows (h-8 / h-10) + space-y-1.5 gaps.
  const deviceListClass = isPage
    ? 'space-y-1.5 max-h-[8.25rem] overflow-y-auto overscroll-contain pr-0.5'
    : 'space-y-1.5 max-h-[6.75rem] overflow-y-auto overscroll-contain pr-0.5';

  const devicesBlock = (
    <div>
      {isPage && (
        <h3 className="text-xs font-semibold text-muted mb-2">
          Available devices
        </h3>
      )}
      {!devicesHydrated && devices.length === 0 ? (
        <div className="space-y-1.5" aria-hidden="true">
          <div
            className={`w-full rounded-lg bg-surface/80 border border-transparent animate-pulse ${
              isPage ? 'h-10' : 'h-8'
            }`}
          />
        </div>
      ) : devices.length > 0 ? (
        <div className={deviceListClass}>
          {devices.map((device) => {
            const DeviceIcon = getSpotifyDeviceIcon(device.type);
            const devicesDisabled = !devicesHydrated || devicesRefreshing;
            return (
              <button
                key={device.id}
                type="button"
                disabled={devicesDisabled}
                onClick={() => void handleDeviceChange(device.id)}
                className={`w-full flex items-center gap-2 rounded-lg text-left transition-colors ${
                  isPage ? 'px-3 py-2' : 'px-2 py-1.5'
                } ${devicesDisabled ? 'opacity-60 cursor-wait' : ''} ${
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
  );

  const transportBlock = (
    <div
      className={`flex items-center justify-center ${
        isPage ? 'gap-3' : 'gap-4'
      }`}
    >
      <button
        type="button"
        onClick={() => void handleSkip('previous')}
        disabled={isPerformingAction}
        className={`${
          isPage ? 'p-3' : 'p-2'
        } rounded-lg text-muted hover:text-bone hover:bg-surface disabled:opacity-50`}
        title="Previous"
      >
        <SkipBack className={isPage ? 'w-7 h-7' : 'w-6 h-6'} />
      </button>
      <button
        type="button"
        onClick={() => void handlePlayPause()}
        disabled={isPerformingAction}
        className={`${
          isPage ? 'p-4' : 'p-3'
        } rounded-full bg-accent hover:bg-accent-hover text-ink disabled:opacity-50 shadow-md`}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className={isPage ? 'w-8 h-8' : 'w-6 h-6'} />
        ) : (
          <Play className={isPage ? 'w-8 h-8' : 'w-6 h-6'} />
        )}
      </button>
      <button
        type="button"
        onClick={() => void handleSkip('next')}
        disabled={isPerformingAction}
        className={`${
          isPage ? 'p-3' : 'p-2'
        } rounded-lg text-muted hover:text-bone hover:bg-surface disabled:opacity-50`}
        title="Next"
      >
        <SkipForward className={isPage ? 'w-7 h-7' : 'w-6 h-6'} />
      </button>
    </div>
  );

  const progressBlock = (
    <div className="w-full space-y-1.5">
      <div
        className="h-1.5 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={durationMs || 100}
        aria-valuenow={displayProgressMs}
        aria-label="Track progress"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000 linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted">
        <span>{formatTrackTime(displayProgressMs)}</span>
        <span>{formatTrackTime(durationMs)}</span>
      </div>
    </div>
  );

  return (
    <div className={shellClass}>
      {isPage && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-bone">Playback Controls</h2>
          {connected ? connectedChip : null}
        </div>
      )}

      {isPage && !connected && disconnectedBlock}
      {!isPage && !connected && disconnectedBlock}

      {connected && isPage && (
        <div className="space-y-4">
          {/* Spotify-style 3-column player row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div className="min-w-0 order-1 lg:order-1">
              {nowPlayingBlock}
            </div>
            <div className="order-3 lg:order-2 flex justify-center">
              {transportBlock}
            </div>
            <div className="min-w-0 order-2 lg:order-3 space-y-3 lg:justify-self-end w-full lg:max-w-sm">
              {devicesBlock}
              {volumeBlock}
            </div>
          </div>

          {progressBlock}
        </div>
      )}

      {connected && !isPage && (
        // Fixed-height sidebar stack keeps transport stable while track/devices change.
        <div className="flex flex-col gap-4 min-h-[22.25rem]">
          <div className="h-14 shrink-0 flex items-center justify-center">
            {transportBlock}
          </div>
          <div className="min-h-10 shrink-0 flex items-center">
            {nowPlayingBlock}
          </div>
          <div className="shrink-0">{volumeBlock}</div>
          <div className="min-h-[6.75rem] shrink-0">{devicesBlock}</div>
          <div className="shrink-0 mt-auto">{sidebarConnectedRow}</div>
        </div>
      )}

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
