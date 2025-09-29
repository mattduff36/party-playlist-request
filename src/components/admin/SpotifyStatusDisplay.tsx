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
          lastUpdated: new Date().toISOString()
        });
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch Spotify status');
        setStatus(prev => ({ ...prev, connected: false }));
      }
    } catch (err) {
      setError('Network error checking Spotify status');
      setStatus(prev => ({ ...prev, connected: false }));
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh status every 5 seconds
  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
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
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Spotify Status</h2>
          <p className="text-gray-400 text-sm">Real-time connection and playback status</p>
        </div>
        
        <button
          onClick={fetchStatus}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Connection Status */}
      <div className="mb-6">
        <div className={`
          flex items-center space-x-3 p-4 rounded-lg border-2
          ${status.connected 
            ? 'bg-green-900/20 border-green-600' 
            : 'bg-red-900/20 border-red-600'
          }
        `}>
          {status.connected ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : (
            <WifiOff className="w-6 h-6 text-red-400" />
          )}
          
          <div className="flex-1">
            <div className={`font-semibold ${status.connected ? 'text-green-400' : 'text-red-400'}`}>
              {status.connected ? 'Connected to Spotify' : 'Not Connected'}
            </div>
            <div className="text-gray-400 text-sm">
              Last updated: {new Date(status.lastUpdated).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {(error || status.error) && (
        <div className="mb-6 flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error || status.error}</span>
        </div>
      )}

      {/* Current Track */}
      {status.connected && status.currentTrack && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Now Playing</h3>
          
          <div className="bg-gray-700 rounded-lg p-4">
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

      {/* Device Info */}
      {status.connected && status.device && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Active Device</h3>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-4">
              {(() => {
                const DeviceIcon = getDeviceIcon(status.device.type);
                return <DeviceIcon className="w-6 h-6 text-gray-400" />;
              })()}
              
              <div className="flex-1">
                <div className="font-medium text-white">
                  {status.device.name}
                </div>
                <div className="text-gray-400 text-sm capitalize">
                  {status.device.type}
                </div>
              </div>
              
              <div className="flex items-center space-x-1 text-gray-400">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm">{status.device.volume_percent}%</span>
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
          <a
            href="/admin/spotify-setup"
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Connect Spotify
          </a>
        </div>
      )}
    </div>
  );
}
