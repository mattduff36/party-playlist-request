'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX,
  Monitor,
  Smartphone,
  Speaker,
  Loader2,
  AlertCircle,
  Music2,
  RefreshCw
} from 'lucide-react';

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface CurrentTrack {
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  progress_ms: number;
  is_playing: boolean;
  image?: string;
}

export default function SpotifyPage() {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [volume, setVolume] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Fetch Spotify status
  const fetchSpotifyStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Spotify status');
      }

      const data = await response.json();
      setIsConnected(data.connected);

      if (data.connected && data.current_track) {
        setCurrentTrack({
          name: data.current_track.name,
          artists: data.current_track.artists,
          album: data.current_track.album,
          duration_ms: data.current_track.duration_ms,
          progress_ms: data.current_track.progress_ms,
          is_playing: data.is_playing,
          image: data.current_track.image
        });
        
        // Get volume from device info if available
        if (data.device && data.device.volume_percent !== undefined) {
          setVolume(data.device.volume_percent);
        }
      }
    } catch (error) {
      console.error('Failed to fetch Spotify status:', error);
      setError('Failed to load Spotify status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch available devices
  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/devices', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  }, []);

  useEffect(() => {
    fetchSpotifyStatus();
    fetchDevices();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchSpotifyStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSpotifyStatus, fetchDevices]);

  // Playback controls
  const handlePlayPause = async () => {
    if (isPerformingAction) return;
    setIsPerformingAction(true);
    try {
      const endpoint = currentTrack?.is_playing 
        ? '/api/admin/playback/pause' 
        : '/api/admin/playback/resume';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to toggle playback');
      }

      // Refresh status after a short delay
      setTimeout(fetchSpotifyStatus, 500);
    } catch (error) {
      console.error('Failed to toggle playback:', error);
      setError('Failed to toggle playback');
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleNext = async () => {
    if (isPerformingAction) return;
    setIsPerformingAction(true);
    try {
      const response = await fetch('/api/admin/playback/skip', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to skip track');
      }

      setTimeout(fetchSpotifyStatus, 500);
    } catch (error) {
      console.error('Failed to skip track:', error);
      setError('Failed to skip track');
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handlePrevious = async () => {
    if (isPerformingAction) return;
    setIsPerformingAction(true);
    try {
      const response = await fetch('/api/admin/playback/previous', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to go to previous track');
      }

      setTimeout(fetchSpotifyStatus, 500);
    } catch (error) {
      console.error('Failed to go to previous track:', error);
      setError('Failed to go to previous track');
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);

    try {
      const response = await fetch('/api/admin/playback/volume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ volume: newVolume })
      });

      if (!response.ok) {
        throw new Error('Failed to set volume');
      }
    } catch (error) {
      console.error('Failed to set volume:', error);
      setError('Failed to set volume');
    }
  };

  const handleDeviceChange = async (deviceId: string) => {
    try {
      const response = await fetch('/api/spotify/transfer-playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ device_id: deviceId })
      });

      if (!response.ok) {
        throw new Error('Failed to transfer playback');
      }

      setTimeout(() => {
        fetchDevices();
        fetchSpotifyStatus();
      }, 1000);
    } catch (error) {
      console.error('Failed to transfer playback:', error);
      setError('Failed to transfer playback');
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return Monitor;
      case 'smartphone':
        return Smartphone;
      case 'speaker':
        return Speaker;
      default:
        return Speaker;
    }
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#1DB954] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Spotify controls...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-8">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Music2 className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Spotify Not Connected</h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto mb-6">
            Connect your Spotify account to access playback controls.
          </p>
          <button
            onClick={() => window.location.href = '/api/spotify/auth'}
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 px-8 rounded-lg transition-all duration-300"
          >
            Connect Spotify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Now Playing Card */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Now Playing</h2>
          <button
            onClick={() => {
              fetchSpotifyStatus();
              fetchDevices();
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {currentTrack ? (
          <div className="space-y-4">
            {/* Track Info */}
            <div className="flex items-center space-x-4">
              {currentTrack.image && (
                <img
                  src={currentTrack.image}
                  alt={currentTrack.name}
                  className="w-24 h-24 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-white truncate">
                  {currentTrack.name}
                </h3>
                <p className="text-gray-400 truncate">
                  {currentTrack.artists?.join(', ') || 'Unknown Artist'}
                </p>
                <p className="text-gray-500 text-sm truncate">
                  {currentTrack.album || 'Unknown Album'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-[#1DB954] h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: `${(currentTrack.progress_ms / currentTrack.duration_ms) * 100}%`
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatDuration(currentTrack.progress_ms)}</span>
                <span>{formatDuration(currentTrack.duration_ms)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={handlePrevious}
                disabled={isPerformingAction}
                className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={handlePlayPause}
                disabled={isPerformingAction}
                className="p-4 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                title={currentTrack.is_playing ? 'Pause' : 'Play'}
              >
                {isPerformingAction ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : currentTrack.is_playing ? (
                  <Pause className="w-8 h-8" fill="currentColor" />
                ) : (
                  <Play className="w-8 h-8" fill="currentColor" />
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={isPerformingAction}
                className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Music2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No track currently playing</p>
            <p className="text-gray-500 text-sm mt-2">
              Start playing music on your Spotify app
            </p>
          </div>
        )}
      </div>

      {/* Volume Control */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Volume Control</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => handleVolumeChange(0)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <VolumeX className="w-6 h-6" />
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1DB954] [&::-webkit-slider-thumb]:cursor-pointer"
          />

          <button
            onClick={() => handleVolumeChange(100)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <Volume2 className="w-6 h-6" />
          </button>

          <div className="w-12 text-right">
            <span className="text-white font-semibold">{volume}%</span>
          </div>
        </div>
      </div>

      {/* Device Selector */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Available Devices</h2>
        {devices.length > 0 ? (
          <div className="space-y-2">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.type);
              return (
                <button
                  key={device.id}
                  onClick={() => !device.is_active && handleDeviceChange(device.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                    device.is_active
                      ? 'bg-[#1DB954]/20 border-2 border-[#1DB954]'
                      : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <DeviceIcon
                      className={`w-6 h-6 ${
                        device.is_active ? 'text-[#1DB954]' : 'text-gray-400'
                      }`}
                    />
                    <div className="text-left">
                      <div
                        className={`font-semibold ${
                          device.is_active ? 'text-[#1DB954]' : 'text-white'
                        }`}
                      >
                        {device.name}
                      </div>
                      <div className="text-gray-400 text-sm capitalize">
                        {device.type}
                      </div>
                    </div>
                  </div>
                  {device.is_active && (
                    <span className="text-[#1DB954] font-semibold text-sm">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Speaker className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No devices available</p>
            <p className="text-gray-500 text-sm mt-2">
              Open Spotify on a device to see it here
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          💡 <strong>Tip:</strong> These controls work with your active Spotify session. 
          If you don't see any devices, open Spotify on your phone, computer, or smart speaker.
        </p>
      </div>
    </div>
  );
}
