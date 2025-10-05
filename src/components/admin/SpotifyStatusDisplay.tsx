/**
 * Spotify Status Display Component
 * 
 * This component provides real-time Spotify connection status display
 * with error handling and connection health monitoring.
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Music,
  Volume2,
  Smartphone,
  Monitor,
  Clock
} from 'lucide-react';

interface SpotifyStatusDisplayProps {
  className?: string;
}

interface SpotifyStatus {
  connected: boolean;
  isPlaying: boolean;
  currentTrack?: {
    name: string;
    artist: string;
    album: string;
    image_url?: string;
    duration_ms: number;
    progress_ms: number;
  };
  device?: {
    name: string;
    type: string;
    volume_percent: number;
  };
  error?: string;
  status_message?: string;
  requires_manual_reconnect?: boolean;
  lastUpdated: string;
}

export default function SpotifyStatusDisplay({ className = '' }: SpotifyStatusDisplayProps) {
  const [status, setStatus] = useState<SpotifyStatus>({
    connected: false,
    isPlaying: false,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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
        setError(null);
        
        // Return whether we should continue polling
        return !data.requires_manual_reconnect;
      } else {
        setError(data.error || 'Failed to fetch Spotify status');
        setStatus(prev => ({ ...prev, connected: false }));
        return true; // Continue polling on errors
      }
    } catch (err) {
      setError('Network error checking Spotify status');
      setStatus(prev => ({ ...prev, connected: false }));
      return true; // Continue polling on errors
    } finally {
      setLoading(false);
    }
  };

  // Handle connect button click - redirect directly to Spotify auth
  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Not authenticated. Please log in first.');
        setIsConnecting(false);
        return;
      }

      // Get Spotify authorization URL
      const response = await fetch('/api/spotify/auth', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initiate Spotify connection');
        setIsConnecting(false);
        return;
      }

      const data = await response.json();
      
      // Store OAuth data in localStorage for callback
      localStorage.setItem('spotify_state', data.state);
      localStorage.setItem('spotify_code_verifier', data.code_verifier);
      
      // Redirect to Spotify authorization
      window.location.href = data.auth_url;
    } catch (err) {
      console.error('Error connecting to Spotify:', err);
      setError('Failed to connect to Spotify. Please try again.');
      setIsConnecting(false);
    }
  };

  // Auto-refresh status every 5 seconds, but stop if permanently disconnected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    // Initial fetch
    fetchStatus().then(shouldContinue => {
      if (shouldContinue) {
        // Only start polling if we should continue
        interval = setInterval(async () => {
          const keepPolling = await fetchStatus();
          if (!keepPolling && interval) {
            console.log('🎵 Spotify Status: Stopping polling - manual reconnect required');
            clearInterval(interval);
            interval = null;
          }
        }, 5000);
      } else {
        console.log('🎵 Spotify Status: Not starting polling - manual reconnect required');
      }
    });
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!status.currentTrack) return 0;
    return (status.currentTrack.progress_ms / status.currentTrack.duration_ms) * 100;
  };

  const getDeviceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'computer':
        return Monitor;
      case 'smartphone':
        return Smartphone;
      default:
        return Music;
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Spotify Status</h2>
          <p className="text-gray-400 text-sm">Real-time connection and playback status</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Device Badge - only show when connected */}
          {status.connected && status.device && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg">
              {(() => {
                const DeviceIcon = getDeviceIcon(status.device.type);
                return <DeviceIcon className="w-4 h-4 text-gray-400" />;
              })()}
              <span className="text-xs text-gray-300">{status.device.name}</span>
              <div className="flex items-center gap-1 text-gray-400">
                <Volume2 className="w-3 h-3" />
                <span className="text-xs">{status.device.volume_percent}%</span>
              </div>
            </div>
          )}
          
          <button
            onClick={fetchStatus}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {(error || status.error || status.requires_manual_reconnect || status.status_message) && (
        <div className="mb-4 space-y-2">
          {(error || status.error) && (
            <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error || status.error}</span>
            </div>
          )}
          {status.requires_manual_reconnect && (
            <div className="flex items-center space-x-2 text-amber-400 bg-amber-900/20 border border-amber-600 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Please reconnect Spotify manually</span>
            </div>
          )}
          {status.status_message && !error && !status.error && (
            <div className="flex items-center space-x-2 text-gray-400 bg-gray-700/50 border border-gray-600 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{status.status_message}</span>
            </div>
          )}
        </div>
      )}

      {/* Current Track */}
      {status.connected && status.currentTrack && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Now Playing</h3>
          
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center space-x-4">
              {/* Album Art */}
              <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {status.currentTrack.image_url ? (
                  <img 
                    src={status.currentTrack.image_url} 
                    alt="Album art" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white truncate">
                  {status.currentTrack.name}
                </h4>
                <p className="text-gray-400 text-sm truncate">
                  {status.currentTrack.artist} • {status.currentTrack.album}
                </p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDuration(status.currentTrack.progress_ms)} / {formatDuration(status.currentTrack.duration_ms)}
                    </span>
                  </span>
                  {status.isPlaying && (
                    <span className="flex items-center space-x-1 text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Playing</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-200"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Track Playing */}
      {status.connected && !status.currentTrack && (
        <div className="text-center py-8">
          <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Track Playing</h3>
          <p className="text-gray-500">
            Start playing music on your Spotify device to see track information here.
          </p>
        </div>
      )}

      {/* Not Connected */}
      {!status.connected && (
        <div className="text-center py-8">
          <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Spotify Not Connected</h3>
          <p className="text-gray-500 mb-4">
            Connect your Spotify account to see playback status and control music.
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Spotify'
            )}
          </button>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
