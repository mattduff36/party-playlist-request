/**
 * Spotify Status Dropdown Component
 *
 * Compact Spotify status icon with dropdown showing connection details.
 * Connection truth comes from AdminDataContext (shared / debounced).
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Music2,
  WifiOff,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  Power,
} from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { markSpotifyOAuthPending } from '@/lib/spotify-oauth-client';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

export default function SpotifyStatusDropdown() {
  const { state: eventState } = useGlobalEvent();
  const {
    spotifyConnected,
    setSpotifyConnected,
    playbackState,
    loading: adminLoading,
    refreshPlaybackState,
  } = useAdminData();
  const pathname = usePathname();
  const router = useRouter();
  const username = pathname?.split('/')[1] || '';
  const [isOpen, setIsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [requiresManualReconnect, setRequiresManualReconnect] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDisabledDueToOffline = eventState?.status === 'offline';
  const loading = adminLoading && !spotifyConnected && !playbackState;

  const currentTrack = playbackState?.track_name
    ? {
        name: playbackState.track_name,
        artist: playbackState.artist_name || '',
        album: playbackState.album_name || '',
        image_url: playbackState.image_url,
      }
    : null;

  const fetchExtras = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        if (typeof data.connected === 'boolean') {
          setSpotifyConnected(data.connected);
        }
        setStatusMessage(data.status_message);
        setRequiresManualReconnect(Boolean(data.requires_manual_reconnect));
      }
      await refreshPlaybackState();
    } catch (err) {
      console.error('Error fetching Spotify status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  function handleConnect() {
    markSpotifyOAuthPending();
    window.location.href = '/api/spotify/auth';
  }

  const handleResetState = async () => {
    try {
      await authenticatedFetch('/api/spotify/reset-connection-state', {
        method: 'POST',
      });
      await fetchExtras();
    } catch (error) {
      console.error('Error resetting connection state:', error);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getStatusColor = () => {
    if (loading) return 'text-muted';
    if (spotifyConnected) return 'text-accent';
    if (requiresManualReconnect) return 'text-amber-400';
    return 'text-muted';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-surface rounded-lg transition-colors"
        title="Spotify Status"
      >
        <Music2 className={`w-5 h-5 ${getStatusColor()}`} />

        {!loading && (
          <span
            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
              spotifyConnected ? 'bg-accent' : 'bg-surface'
            }`}
          />
        )}

        {requiresManualReconnect && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-elevated rounded-lg shadow-xl border border-white/10 z-50">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-bone font-semibold flex items-center gap-2">
                <Music2 className="w-4 h-4" />
                Spotify Status
              </h3>
              <button
                onClick={() => void fetchExtras()}
                className="p-1 hover:bg-surface rounded transition-colors"
                title="Refresh"
                disabled={refreshing}
              >
                <RefreshCw
                  className={`w-4 h-4 text-muted ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-muted animate-spin" />
              </div>
            ) : (
              <>
                {isDisabledDueToOffline ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/30 border border-white/10">
                    <Power className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-muted">
                        Disabled (Event Offline)
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Spotify is disabled when the event is offline. Change
                        event status to Standby or Live to enable Spotify.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      spotifyConnected
                        ? 'bg-accent/10 border border-accent/30'
                        : 'bg-surface/30 border border-white/10'
                    }`}
                  >
                    {spotifyConnected ? (
                      <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-medium text-sm ${
                          spotifyConnected ? 'text-accent' : 'text-muted'
                        }`}
                      >
                        {spotifyConnected ? 'Connected' : 'Not Connected'}
                      </div>

                      {statusMessage && (
                        <div className="text-xs text-muted mt-1">
                          {statusMessage}
                        </div>
                      )}

                      {requiresManualReconnect && (
                        <div className="flex items-center gap-1 text-xs text-amber-400 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Manual reconnection required
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {spotifyConnected && currentTrack && (
                  <div className="p-3 bg-surface/30 rounded-lg">
                    <div className="text-xs text-muted mb-2">Now Playing</div>
                    <div className="flex gap-3">
                      {currentTrack.image_url && (
                        <img
                          src={currentTrack.image_url}
                          alt="Album art"
                          className="w-12 h-12 rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-bone font-medium text-sm truncate">
                          {currentTrack.name}
                        </div>
                        <div className="text-muted text-xs truncate">
                          {currentTrack.artist}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {spotifyConnected && playbackState?.device_name && (
                  <div className="text-xs text-muted">
                    Playing on:{' '}
                    <span className="text-muted">
                      {playbackState.device_name}
                    </span>
                  </div>
                )}

                {!isDisabledDueToOffline && (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    {!spotifyConnected ? (
                      <>
                        <button
                          onClick={handleConnect}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-ink text-sm font-medium rounded-lg transition-colors"
                        >
                          <Music2 className="w-4 h-4" />
                          Connect to Spotify
                          <ExternalLink className="w-3 h-3" />
                        </button>

                        {requiresManualReconnect && (
                          <button
                            onClick={() => void handleResetState()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-muted hover:text-bone text-xs transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Reset Connection State
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          if (username) {
                            router.push(`/${username}/admin/spotify`);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-muted hover:text-bone text-sm transition-colors"
                      >
                        Manage Spotify
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
