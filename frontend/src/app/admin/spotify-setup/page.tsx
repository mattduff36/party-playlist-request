'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface SpotifyStatus {
  authenticated: boolean;
  user?: {
    id: string;
    display_name: string;
    email: string;
    product: string;
  };
  devices?: Array<{
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    volume_percent: number;
  }>;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  public: boolean;
  tracks_total: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function SpotifySetupPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check for admin token
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (!savedToken) {
      router.push('/admin');
      return;
    }
    setToken(savedToken);
    fetchSpotifyStatus(savedToken);
  }, []);

  // Fetch Spotify status
  const fetchSpotifyStatus = async (authToken: string) => {
    try {
      const response = await axios.get(`${API_BASE}/spotify/status`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSpotifyStatus(response.data);
      
      if (response.data.authenticated) {
        fetchPlaylists(authToken);
      }
    } catch (error) {
      console.error('Error fetching Spotify status:', error);
    }
  };

  // Fetch user playlists
  const fetchPlaylists = async (authToken: string) => {
    try {
      const response = await axios.get(`${API_BASE}/spotify/playlists`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPlaylists(response.data.playlists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  // Start Spotify authentication
  const startSpotifyAuth = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_BASE}/spotify/auth`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Store code verifier for callback
      localStorage.setItem('spotify_code_verifier', response.data.code_challenge);
      localStorage.setItem('spotify_state', response.data.state);
      
      // Redirect to Spotify authorization
      window.location.href = response.data.auth_url;
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to start Spotify authentication');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth callback (when user returns from Spotify)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError(`Spotify authentication failed: ${error}`);
      return;
    }

    if (code && state) {
      handleSpotifyCallback(code, state);
    }
  }, []);

  const handleSpotifyCallback = async (code: string, state: string) => {
    const storedState = localStorage.getItem('spotify_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    if (state !== storedState) {
      setError('Invalid state parameter');
      return;
    }

    if (!codeVerifier) {
      setError('Missing code verifier');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/spotify/callback`, {
        code,
        state,
        code_verifier: codeVerifier
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Spotify authentication successful!');
      
      // Clean up localStorage
      localStorage.removeItem('spotify_code_verifier');
      localStorage.removeItem('spotify_state');
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, '/admin/spotify-setup');
      
      // Refresh status
      fetchSpotifyStatus(token);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to complete Spotify authentication');
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect Spotify
  const disconnectSpotify = async () => {
    if (!confirm('Are you sure you want to disconnect Spotify?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/spotify/disconnect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Spotify disconnected successfully');
      setSpotifyStatus(null);
      setPlaylists([]);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to disconnect Spotify');
    }
  };

  // Create party playlist
  const createPartyPlaylist = async () => {
    const name = prompt('Enter playlist name:', 'Party DJ Requests');
    if (!name) return;

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/spotify/create-playlist`, {
        name,
        description: 'Songs requested at the party',
        public: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Playlist "${response.data.playlist.name}" created successfully!`);
      fetchPlaylists(token);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create playlist');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">🎵 Spotify Setup</h1>
          <button
            onClick={() => router.push('/admin')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Admin
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        {/* Spotify Connection Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Spotify Connection Status</h2>
          
          {spotifyStatus?.authenticated ? (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-green-700 font-semibold">Connected to Spotify</span>
              </div>

              {spotifyStatus.user && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Account Information</h3>
                  <p><strong>Name:</strong> {spotifyStatus.user.display_name}</p>
                  <p><strong>Email:</strong> {spotifyStatus.user.email}</p>
                  <p><strong>Plan:</strong> {spotifyStatus.user.product}</p>
                </div>
              )}

              <button
                onClick={disconnectSpotify}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
              >
                Disconnect Spotify
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-red-700 font-semibold">Not connected to Spotify</span>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">⚠️ Before Connecting:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Make sure you have created a Spotify Developer App</li>
                  <li>Verify your Client ID and Client Secret are set in the backend</li>
                  <li>Ensure the redirect URI matches: <code>http://localhost:3001/api/spotify/callback</code></li>
                  <li>You need Spotify Premium for full playback control features</li>
                </ul>
              </div>

              <button
                onClick={startSpotifyAuth}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
              >
                {isLoading ? 'Connecting...' : 'Connect Spotify Account'}
              </button>
            </div>
          )}
        </div>

        {/* Available Devices */}
        {spotifyStatus?.devices && spotifyStatus.devices.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Available Devices</h2>
            <div className="grid gap-4">
              {spotifyStatus.devices.map((device) => (
                <div
                  key={device.id}
                  className={`p-4 rounded-lg border ${
                    device.is_active ? 'border-green-500 bg-green-50' : 'border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{device.name}</h3>
                      <p className="text-gray-600 text-sm">{device.type}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded text-xs ${
                        device.is_active ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {device.is_active ? 'Active' : 'Inactive'}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Volume: {device.volume_percent}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playlist Management */}
        {spotifyStatus?.authenticated && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Party Playlists</h2>
              <button
                onClick={createPartyPlaylist}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
              >
                Create New Playlist
              </button>
            </div>

            {playlists.length > 0 ? (
              <div className="grid gap-4">
                {playlists.map((playlist) => (
                  <div key={playlist.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{playlist.name}</h3>
                        <p className="text-gray-600 text-sm">{playlist.description}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          {playlist.tracks_total} tracks • {playlist.public ? 'Public' : 'Private'}
                        </p>
                      </div>
                      <div className="text-right">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {playlist.id}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No playlists found. Create one to get started!
              </p>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">📋 Setup Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Create a Spotify Developer App at <a href="https://developer.spotify.com/dashboard" target="_blank" className="text-blue-600 underline">developer.spotify.com</a></li>
            <li>Copy your Client ID and Client Secret to the backend .env file</li>
            <li>Set the redirect URI to: <code className="bg-gray-200 px-1 rounded">http://localhost:3001/api/spotify/callback</code></li>
            <li>Click "Connect Spotify Account" above to authenticate</li>
            <li>Create or select a playlist for approved songs</li>
            <li>Start playing music on any device to enable queue control</li>
          </ol>
        </div>
      </div>
    </div>
  );
}