/**
 * Spotify Status Dropdown Component
 * 
 * Compact Spotify status icon with dropdown showing connection details
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
  Power
} from 'lucide-react';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { markSpotifyOAuthPending } from '@/lib/spotify-oauth-client';

interface SpotifyStatus {
  connected: boolean;
  isPlaying: boolean;
  currentTrack?: {
    name: string;
    artist: string;
    album: string;
    image_url?: string;
  };
  device?: {
    name: string;
    type: string;
  };
  error?: string;
  status_message?: string;
  requires_manual_reconnect?: boolean;
  lastUpdated: string;
}

export default function SpotifyStatusDropdown() {
  const { state: eventState } = useGlobalEvent();
  const pathname = usePathname();
  const router = useRouter();
  const username = pathname?.split('/')[1] || '';
  const [status, setStatus] = useState<SpotifyStatus>({
    connected: false,
    isPlaying: false,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if Spotify is disabled due to offline state
  const isDisabledDueToOffline = eventState?.status === 'offline';

  // Fetch Spotify status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/spotify/status');
      const data = await response.json();
      
      if (response.ok) {
        setStatus({
          connected: data.connected,
          isPlaying: data.is_playing || false,
          currentTrack: data.current_track,
          device: data.device,
          error: data.error,
          status_message: data.status_message,
          requires_manual_reconnect: data.requires_manual_reconnect,
          lastUpdated: new Date().toISOString()
        });
        
        return !data.requires_manual_reconnect;
      }
      return true;
    } catch (err) {
      console.error('Error fetching Spotify status:', err);
      setStatus(prev => ({ ...prev, connected: false }));
      return true;
    } finally {
      setLoading(false);
    }
  };

  // Connect to Spotify — navigate directly so the browser follows the 307 to Spotify.
  // Do not fetch() this endpoint: it returns a redirect, not JSON, so fetch fails silently.
  function handleConnect() {
    markSpotifyOAuthPending();
    window.location.href = '/api/spotify/auth';
  }

  // Reset connection state
  const handleResetState = async () => {
    try {
      await fetch('/api/spotify/reset-connection-state', {
        method: 'POST',
        credentials: 'include' // JWT auth via cookies
      });
      
      await fetchStatus();
    } catch (error) {
      console.error('Error resetting connection state:', error);
    }
  };

  // Poll for status updates (only when not offline)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    // Don't poll when offline
    if (isDisabledDueToOffline) {
      setLoading(false);
      return;
    }
    
    fetchStatus().then(shouldContinue => {
      if (shouldContinue) {
        interval = setInterval(async () => {
          const keepPolling = await fetchStatus();
          if (!keepPolling && interval) {
            clearInterval(interval);
            interval = null;
          }
        }, 10000); // Poll every 10 seconds (less aggressive for dropdown)
      }
    });
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDisabledDueToOffline]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get status icon color
  const getStatusColor = () => {
    if (loading) return 'text-muted';
    if (status.connected) return 'text-accent';
    if (status.requires_manual_reconnect) return 'text-amber-400';
    return 'text-muted';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-surface rounded-lg transition-colors"
        title="Spotify Status"
      >
        <Music2 className={`w-5 h-5 ${getStatusColor()}`} />
        
        {/* Status Indicator Dot */}
        {!loading && (
          <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
            status.connected ? 'bg-accent' : 'bg-surface'
          }`} />
        )}
        
        {/* Warning Indicator */}
        {status.requires_manual_reconnect && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-elevated rounded-lg shadow-xl border border-white/10 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-bone font-semibold flex items-center gap-2">
                <Music2 className="w-4 h-4" />
                Spotify Status
              </h3>
              <button
                onClick={fetchStatus}
                className="p-1 hover:bg-surface rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-muted" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-muted animate-spin" />
              </div>
            ) : (
              <>
                {/* Offline State Warning */}
                {isDisabledDueToOffline ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/30 border border-white/10">
                    <Power className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-muted">
                        Disabled (Event Offline)
                      </div>
                      <div className="text-xs text-muted mt-1">
                        Spotify is disabled when the event is offline. Change event status to Standby or Live to enable Spotify.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Connection Status */}
                    <div className={`flex items-start gap-3 p-3 rounded-lg ${
                      status.connected 
                        ? 'bg-accent/10 border border-accent/30' 
                        : 'bg-surface/30 border border-white/10'
                    }`}>
                      {status.connected ? (
                        <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${
                          status.connected ? 'text-accent' : 'text-muted'
                        }`}>
                          {status.connected ? 'Connected' : 'Not Connected'}
                        </div>
                        
                        {status.status_message && (
                          <div className="text-xs text-muted mt-1">
                            {status.status_message}
                          </div>
                        )}
                        
                        {status.requires_manual_reconnect && (
                          <div className="flex items-center gap-1 text-xs text-amber-400 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            Manual reconnection required
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Current Track */}
                {status.connected && status.currentTrack && (
                  <div className="p-3 bg-surface/30 rounded-lg">
                    <div className="text-xs text-muted mb-2">Now Playing</div>
                    <div className="flex gap-3">
                      {status.currentTrack.image_url && (
                        <img 
                          src={status.currentTrack.image_url} 
                          alt="Album art"
                          className="w-12 h-12 rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-bone font-medium text-sm truncate">
                          {status.currentTrack.name}
                        </div>
                        <div className="text-muted text-xs truncate">
                          {status.currentTrack.artist}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Device */}
                {status.connected && status.device && (
                  <div className="text-xs text-muted">
                    Playing on: <span className="text-muted">{status.device.name}</span>
                  </div>
                )}

                {/* Actions - only show when not offline */}
                {!isDisabledDueToOffline && (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    {!status.connected ? (
                      <>
                        <button
                          onClick={handleConnect}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-ink text-sm font-medium rounded-lg transition-colors"
                        >
                          <Music2 className="w-4 h-4" />
                          Connect to Spotify
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        
                        {status.requires_manual_reconnect && (
                          <button
                            onClick={handleResetState}
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

