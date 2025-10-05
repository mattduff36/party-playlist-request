/**
 * Spotify Connection Panel Component
 * 
 * This component handles Spotify account connection, device selection,
 * and connection status display with error handling.
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Music, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  Volume2,
  Smartphone,
  Monitor
} from 'lucide-react';

interface SpotifyConnectionPanelProps {
  className?: string;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  volume_percent: number;
  is_active: boolean;
}

interface SpotifyConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  devices: SpotifyDevice[];
  selectedDevice: SpotifyDevice | null;
  user: {
    display_name: string;
    id: string;
  } | null;
}

export default function SpotifyConnectionPanel({ className = '' }: SpotifyConnectionPanelProps) {
  const [state, setState] = useState<SpotifyConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    devices: [],
    selectedDevice: null,
    user: null
  });

  // Check Spotify connection status
  const checkConnectionStatus = async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const response = await fetch('/api/spotify/status');
      const data = await response.json();
      
      if (response.ok) {
        setState(prev => ({
          ...prev,
          isConnected: data.connected,
          devices: data.devices || [],
          selectedDevice: data.devices?.find((d: SpotifyDevice) => d.is_active) || null,
          user: data.user || null,
          error: null
        }));
      } else {
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: data.error || 'Failed to check connection status'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        error: 'Network error checking connection status'
      }));
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Connect to Spotify
  const connectToSpotify = async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const response = await fetch('/api/spotify/connect', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok && data.authUrl) {
        // Redirect to Spotify authorization
        window.location.href = data.authUrl;
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to initiate Spotify connection'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Network error connecting to Spotify'
      }));
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Reset connection state (allows retry after permanent failure)
  const resetConnectionState = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setState(prev => ({ ...prev, error: 'No admin token found' }));
        return;
      }

      const response = await fetch('/api/spotify/reset-connection-state', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setState(prev => ({ ...prev, error: null }));
        // Refresh the status
        await checkConnectionStatus();
      } else {
        const data = await response.json();
        setState(prev => ({ ...prev, error: data.error || 'Failed to reset connection state' }));
      }
    } catch (error) {
      console.error('Error resetting connection state:', error);
      setState(prev => ({ ...prev, error: 'Failed to reset connection state' }));
    }
  };

  // Disconnect from Spotify
  const disconnectFromSpotify = async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const response = await fetch('/api/spotify/disconnect', { method: 'POST' });
      
      if (response.ok) {
        setState(prev => ({
          ...prev,
          isConnected: false,
          devices: [],
          selectedDevice: null,
          user: null
        }));
      } else {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to disconnect from Spotify'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Network error disconnecting from Spotify'
      }));
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Select device
  const selectDevice = async (deviceId: string) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const response = await fetch('/api/spotify/select-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      
      if (response.ok) {
        setState(prev => ({
          ...prev,
          selectedDevice: prev.devices.find(d => d.id === deviceId) || null
        }));
      } else {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to select device'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Network error selecting device'
      }));
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  // Check connection on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return Monitor;
      case 'smartphone':
        return Smartphone;
      default:
        return Music;
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Spotify Connection</h2>
          <p className="text-gray-400 text-sm">Connect your Spotify account to control playback</p>
        </div>
        
        <button
          onClick={checkConnectionStatus}
          disabled={state.isConnecting}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${state.isConnecting ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Connection Status */}
      <div className="mb-6">
        <div className={`
          flex items-center space-x-3 p-4 rounded-lg border-2
          ${state.isConnected 
            ? 'bg-green-900/20 border-green-600' 
            : 'bg-gray-700 border-gray-600'
          }
        `}>
          {state.isConnected ? (
            <CheckCircle className="w-6 h-6 text-green-400" />
          ) : (
            <WifiOff className="w-6 h-6 text-gray-400" />
          )}
          
          <div className="flex-1">
            <div className={`font-semibold ${state.isConnected ? 'text-green-400' : 'text-gray-300'}`}>
              {state.isConnected ? 'Connected to Spotify' : 'Not Connected'}
            </div>
            {state.user && (
              <div className="text-gray-400 text-sm">
                Logged in as {state.user.display_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connection Actions */}
      {!state.isConnected ? (
        <div className="space-y-4">
          <button
            onClick={connectToSpotify}
            disabled={state.isConnecting}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Music className="w-5 h-5" />
            <span>{state.isConnecting ? 'Connecting...' : 'Connect to Spotify'}</span>
            <ExternalLink className="w-4 h-4" />
          </button>
          
          <p className="text-gray-400 text-sm text-center">
            You'll be redirected to Spotify to authorize the connection
          </p>

          {/* Reset connection state button (for when retries are exhausted) */}
          <div className="pt-2 border-t border-gray-700">
            <button
              onClick={resetConnectionState}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Connection State</span>
            </button>
            <p className="text-gray-500 text-xs text-center mt-1">
              Use if connection keeps failing
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Disconnect Button */}
          <button
            onClick={disconnectFromSpotify}
            disabled={state.isConnecting}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <WifiOff className="w-5 h-5" />
            <span>{state.isConnecting ? 'Disconnecting...' : 'Disconnect from Spotify'}</span>
          </button>

          {/* Device Selection */}
          {state.devices.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Select Playback Device</h3>
              <div className="space-y-2">
                {state.devices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.type);
                  const isSelected = device.id === state.selectedDevice?.id;
                  
                  return (
                    <button
                      key={device.id}
                      onClick={() => selectDevice(device.id)}
                      disabled={state.isConnecting || isSelected}
                      className={`
                        w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200
                        ${isSelected 
                          ? 'bg-green-900/20 border-green-600' 
                          : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                        }
                        ${state.isConnecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <DeviceIcon className={`w-5 h-5 ${isSelected ? 'text-green-400' : 'text-gray-400'}`} />
                        <div className="text-left">
                          <div className={`font-medium ${isSelected ? 'text-green-400' : 'text-white'}`}>
                            {device.name}
                          </div>
                          <div className="text-gray-400 text-sm capitalize">
                            {device.type} • {device.volume_percent}% volume
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Devices Message */}
          {state.devices.length === 0 && (
            <div className="text-center py-8">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No Spotify devices found</p>
              <p className="text-gray-500 text-sm">
                Make sure Spotify is open on one of your devices
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="mt-4 flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{state.error}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {state.isConnecting && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-yellow-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
          <span className="text-sm">Processing...</span>
        </div>
      )}
    </div>
  );
}
