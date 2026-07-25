/**
 * Spotify Connection Panel Component
 *
 * Handles Spotify account connection status and connect/disconnect.
 * Device selection lives on the Spotify admin page (Available Devices).
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Music,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface SpotifyConnectionPanelProps {
  className?: string;
  onConnectionChange?: (connected: boolean) => void;
}

interface ActiveDevice {
  name: string;
  type: string;
  volume_percent: number;
}

interface SpotifyConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  activeDevice: ActiveDevice | null;
}

export default function SpotifyConnectionPanel({
  className = '',
  onConnectionChange,
}: SpotifyConnectionPanelProps) {
  const [state, setState] = useState<SpotifyConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    activeDevice: null,
  });

  const checkConnectionStatus = async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok) {
        const connected = Boolean(data.connected);
        // Ignore expected "not connected" messages — only surface unexpected errors
        const statusError =
          data.error &&
          connected === false &&
          !String(data.error).toLowerCase().includes('not connected')
            ? data.error
            : null;
        setState(prev => ({
          ...prev,
          isConnected: connected,
          // Status returns a single active playback device, not a devices[] list
          activeDevice: data.device ?? null,
          error: statusError,
        }));
        onConnectionChange?.(connected);
      } else {
        setState(prev => ({
          ...prev,
          isConnected: false,
          activeDevice: null,
          error: data.error || 'Failed to check connection status',
        }));
        onConnectionChange?.(false);
      }
    } catch {
      setState(prev => ({
        ...prev,
        isConnected: false,
        activeDevice: null,
        error: 'Network error checking connection status',
      }));
      onConnectionChange?.(false);
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Navigate directly so the browser follows the OAuth redirect.
  // Do not fetch() /api/spotify/auth: it returns a redirect, not JSON.
  const connectToSpotify = () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    window.location.href = '/api/spotify/auth';
  };

  const resetConnectionState = async () => {
    try {
      const response = await fetch('/api/spotify/reset-connection-state', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setState(prev => ({ ...prev, error: null }));
        await checkConnectionStatus();
      } else {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to reset connection state',
        }));
      }
    } catch (error) {
      console.error('Error resetting connection state:', error);
      setState(prev => ({ ...prev, error: 'Failed to reset connection state' }));
    }
  };

  const disconnectFromSpotify = async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const response = await fetch('/api/spotify/disconnect', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          activeDevice: null,
        }));
        onConnectionChange?.(false);
      } else {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to disconnect from Spotify',
        }));
      }
    } catch {
      setState(prev => ({
        ...prev,
        error: 'Network error disconnecting from Spotify',
      }));
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  useEffect(() => {
    checkConnectionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only status check
  }, []);

  return (
    <div className={`bg-elevated rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-bone">Spotify Connection</h2>
          {!state.isConnected && (
            <p className="text-muted text-xs mt-0.5">
              Connect your Spotify account to control playback
            </p>
          )}
        </div>

        <button
          onClick={checkConnectionStatus}
          disabled={state.isConnecting}
          className="p-1.5 text-muted hover:text-bone transition-colors disabled:opacity-50 flex-shrink-0"
          title="Refresh connection status"
        >
          <RefreshCw className={`w-4 h-4 ${state.isConnecting ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {state.isConnected ? (
        <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-[12rem] px-3 py-2 rounded-lg bg-surface border border-white/10">
            <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-bone">Connected to Spotify</div>
              {state.activeDevice && (
                <div className="text-muted text-xs truncate">
                  Active device: {state.activeDevice.name}
                  {typeof state.activeDevice.volume_percent === 'number' && (
                    <> · {state.activeDevice.volume_percent}% volume</>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={disconnectFromSpotify}
            disabled={state.isConnecting}
            className="flex-shrink-0 flex items-center px-3 py-2 text-xs text-red-400/80 border border-red-500/40 rounded-lg hover:text-red-300 hover:border-red-400/60 hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {state.isConnecting ? 'Disconnecting...' : 'Disconnect from Spotify'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface border border-white/10">
            <WifiOff className="w-4 h-4 text-muted flex-shrink-0" />
            <div className="text-sm font-medium text-muted">Not Connected</div>
          </div>

          <button
            onClick={connectToSpotify}
            disabled={state.isConnecting}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-ink font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <Music className="w-4 h-4" />
            <span>{state.isConnecting ? 'Connecting...' : 'Connect to Spotify'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <p className="text-muted text-xs text-center">
            You&apos;ll be redirected to Spotify to authorize the connection
          </p>

          <div className="pt-2 border-t border-white/10">
            <button
              onClick={resetConnectionState}
              className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 text-muted hover:text-bone text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Connection State</span>
            </button>
            <p className="text-faint text-xs text-center mt-1">
              Use if connection keeps failing
            </p>
          </div>
        </div>
      )}

      {state.error && (
        <div className="mt-3 flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{state.error}</span>
        </div>
      )}

      {state.isConnecting && (
        <div className="mt-3 flex items-center justify-center space-x-2 text-muted">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-muted"></div>
          <span className="text-xs">Processing...</span>
        </div>
      )}
    </div>
  );
}
