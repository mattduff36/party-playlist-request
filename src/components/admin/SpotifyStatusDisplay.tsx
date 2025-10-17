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
  Clock,
  Play,
  Pause,
  ChevronDown
} from 'lucide-react';

interface SpotifyStatusDisplayProps {
  className?: string;
  showHeader?: boolean;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  volume_percent: number;
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

export default function SpotifyStatusDisplay({ className = '', showHeader = true }: SpotifyStatusDisplayProps) {
  const [status, setStatus] = useState<SpotifyStatus>({
    connected: false,
    isPlaying: false,
    lastUpdated: new Date().toISOString()
  });
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isControlling, setIsControlling] = useState(false);

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

  // Fetch available devices
  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/spotify/devices', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        
        // Set selected device to the active one
        const activeDevice = data.devices?.find((d: SpotifyDevice) => d.is_active);
        if (activeDevice) {
          setSelectedDevice(activeDevice.id);
        } else if (data.devices?.length > 0 && !selectedDevice) {
          setSelectedDevice(data.devices[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  // Handle play/pause
  const handlePlayPause = async () => {
    setIsControlling(true);
    setError(null);
    
    try {
      const endpoint = status.isPlaying ? '/api/admin/playback/pause' : '/api/admin/playback/resume';
      const body = !status.isPlaying && selectedDevice ? { device_id: selectedDevice } : {};
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Playback control failed');
      } else {
        // Refresh status after a short delay
        setTimeout(() => fetchStatus(), 500);
      }
    } catch (err) {
      console.error('Error controlling playback:', err);
      setError('Failed to control playback. Please try again.');
    } finally {
      setIsControlling(false);
    }
  };

  // Handle device change
  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    setError(null);
    
    // Transfer playback to the new device
    try {
      const response = await fetch('/api/spotify/transfer-playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ device_id: deviceId, play: false })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to switch device');
      } else {
        // Refresh status after switching
        setTimeout(() => {
          fetchStatus();
          fetchDevices();
        }, 1000);
      }
    } catch (err) {
      console.error('Error switching device:', err);
      setError('Failed to switch device. Please try again.');
    }
  };

  // Handle connect button click - redirect directly to Spotify auth
  const handleConnect = () => {
    setIsConnecting(true);
    setError(null);
    
    // Simply navigate to the auth endpoint - it handles the redirect server-side
    // OAuth session data is now stored server-side, no need for localStorage
    console.log('🔗 Redirecting to Spotify authorization...');
    window.location.href = '/api/spotify/auth';
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

  // Fetch devices when connected
  useEffect(() => {
    if (status.connected) {
      fetchDevices();
      // Refresh devices every 10 seconds
      const interval = setInterval(fetchDevices, 10000);
      return () => clearInterval(interval);
    }
  }, [status.connected]);

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
      {showHeader && (
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
      )}

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

              {/* Play/Pause Button */}
              <button
                onClick={handlePlayPause}
                disabled={isControlling}
                className="flex-shrink-0 w-12 h-12 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors"
                title={status.isPlaying ? 'Pause' : 'Play'}
              >
                {isControlling ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : status.isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
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

      {/* No Track Playing - Show Controls */}
      {status.connected && !status.currentTrack && (
        <div className="space-y-4">
          <div className="text-center py-6">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Track Playing</h3>
            <p className="text-gray-500 text-sm mb-6">
              Select a device and start playback
            </p>

            {/* Device Selector */}
            {devices.length > 0 && (
              <div className="mb-4 max-w-md mx-auto">
                <label className="block text-sm font-medium text-gray-400 mb-2 text-left">
                  Playback Device
                </label>
                <div className="relative">
                  <select
                    value={selectedDevice}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer hover:bg-gray-600 transition-colors pr-10"
                  >
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} {device.is_active ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-left">
                  {devices.length} device{devices.length !== 1 ? 's' : ''} available
                </p>
              </div>
            )}

            {/* No devices available message */}
            {devices.length === 0 && (
              <div className="mb-4 p-3 bg-amber-900/20 border border-amber-600/50 rounded-lg max-w-md mx-auto">
                <p className="text-amber-400 text-sm">
                  No Spotify devices found. Please open Spotify on a device first.
                </p>
              </div>
            )}

            {/* Play Button */}
            <button
              onClick={handlePlayPause}
              disabled={isControlling || devices.length === 0}
              className="inline-flex items-center justify-center w-16 h-16 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full transition-colors shadow-lg"
              title={devices.length === 0 ? 'No devices available' : 'Start playback'}
            >
              {isControlling ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </button>

            <p className="text-xs text-gray-500 mt-4">
              Press play to start playback on the selected device
            </p>
          </div>
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
