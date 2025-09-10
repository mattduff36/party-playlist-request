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

const API_BASE = '/api';

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
      localStorage.setItem('spotify_code_verifier', response.data.code_verifier);
      localStorage.setItem('spotify_state', response.data.state);
      
      // For mobile, open in same tab to avoid download issues
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // On mobile, navigate directly
        window.location.href = response.data.auth_url;
      } else {
        // On desktop, can use window.open if preferred
        window.location.href = response.data.auth_url;
      }
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
      setError(decodeURIComponent(error));
      // Clean up URL
      window.history.replaceState({}, document.title, '/admin/spotify-setup');
      return;
    }

    if (code && state && token) {
      handleSpotifyCallback(code, state);
    }
  }, [token]); // Added token dependency

  const handleSpotifyCallback = async (code: string, state: string) => {
    const storedState = localStorage.getItem('spotify_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    console.log('Callback data:', { code, state, storedState, codeVerifier: !!codeVerifier });

    // If no stored state, this might be a fresh page load after redirect
    if (!storedState) {
      console.log('No stored state found - this might be a page refresh after redirect');
      setError('Connection session expired. Please try connecting again.');
      // Clean up URL parameters
      window.history.replaceState({}, document.title, '/admin/spotify-setup');
      return;
    }

    if (state !== storedState) {
      console.log('State mismatch:', { expected: storedState, received: state });
      setError(`Invalid state parameter. Please try connecting again.`);
      // Clean up localStorage and URL
      localStorage.removeItem('spotify_code_verifier');
      localStorage.removeItem('spotify_state');
      window.history.replaceState({}, document.title, '/admin/spotify-setup');
      return;
    }

    if (!codeVerifier) {
      setError('Missing code verifier. Please try connecting again.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/spotify/callback`, {
        code,
        state,
        code_verifier: codeVerifier
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Spotify callback response:', response.data);
      setSuccess('Spotify authentication successful! Redirecting back to admin panel...');
      
      // Clean up localStorage
      localStorage.removeItem('spotify_code_verifier');
      localStorage.removeItem('spotify_state');
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, '/admin/spotify-setup');
      
      // Refresh status
      await fetchSpotifyStatus(token);
      
      // Redirect back to admin after a short delay to show success message
      setTimeout(() => {
        router.push('/admin');
      }, 2000);
    } catch (error: any) {
      console.error('Spotify callback error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to complete Spotify authentication';
      setError(`Authentication failed: ${errorMessage}`);
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
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center">
            🎵 Spotify Setup
          </h1>
          <button
            onClick={() => router.push('/admin')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
          >
            Back to Admin
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/20 border border-red-600 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/20 border border-green-600 text-green-300 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Spotify Connection Status */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 border border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">Spotify Connection Status</h2>
          
          {spotifyStatus?.authenticated ? (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-green-400 font-semibold">Connected to Spotify</span>
              </div>

              {spotifyStatus.user && (
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <h3 className="font-semibold mb-2 text-white">Account Information</h3>
                  <p className="text-gray-300"><strong>Name:</strong> {spotifyStatus.user.display_name}</p>
                  <p className="text-gray-300"><strong>Email:</strong> {spotifyStatus.user.email}</p>
                  <p className="text-gray-300"><strong>Plan:</strong> {spotifyStatus.user.product}</p>
                </div>
              )}

              <button
                onClick={disconnectSpotify}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Disconnect Spotify
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-red-400 font-semibold">Not connected to Spotify</span>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-600 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-yellow-300">⚠️ Before Connecting:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                  <li>Make sure you have created a Spotify Developer App</li>
                  <li>Verify your Client ID and Client Secret are set in Vercel</li>
                  <li className="break-all">Ensure the redirect URI matches: <code className="bg-gray-700 px-1 rounded text-xs text-gray-200">https://partyplaylist.mpdee.co.uk/api/spotify/callback</code></li>
                  <li>You need Spotify Premium for full playback control features</li>
                  <li className="text-blue-400">📱 <strong>Mobile users:</strong> The connection will redirect you to Spotify and back</li>
                </ul>
              </div>

              <button
                onClick={startSpotifyAuth}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Connecting...' : 'Connect Spotify Account'}
              </button>
            </div>
          )}
        </div>

        {/* Available Devices */}
        {spotifyStatus?.devices && spotifyStatus.devices.length > 0 && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 border border-gray-700">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-white">Available Devices</h2>
            <div className="grid gap-4">
              {spotifyStatus.devices.map((device) => (
                <div
                  key={device.id}
                  className={`p-4 rounded-lg border ${
                    device.is_active ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h3 className="font-semibold text-white">{device.name}</h3>
                      <p className="text-gray-300 text-sm">{device.type}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className={`px-2 py-1 rounded text-xs ${
                        device.is_active ? 'bg-green-600 text-green-100' : 'bg-gray-600 text-gray-200'
                      }`}>
                        {device.is_active ? 'Active' : 'Inactive'}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">Volume: {device.volume_percent}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playlist Management */}
        {spotifyStatus?.authenticated && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">Party Playlists</h2>
              <button
                onClick={createPartyPlaylist}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Create New Playlist
              </button>
            </div>

            {playlists.length > 0 ? (
              <div className="grid gap-4">
                {playlists.map((playlist) => (
                  <div key={playlist.id} className="p-4 border border-gray-600 rounded-lg bg-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{playlist.name}</h3>
                        <p className="text-gray-300 text-sm">{playlist.description}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {playlist.tracks_total} tracks • {playlist.public ? 'Public' : 'Private'}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <code className="text-xs bg-gray-600 px-2 py-1 rounded break-all text-gray-200">
                          {playlist.id}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                No playlists found. Create one to get started!
              </p>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4 sm:p-6 mt-6">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-blue-300">📋 Setup Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>Create a Spotify Developer App at <a href="https://developer.spotify.com/dashboard" target="_blank" className="text-blue-400 underline break-all hover:text-blue-300">developer.spotify.com</a></li>
            <li>Copy your Client ID and Client Secret to Vercel environment variables</li>
            <li className="break-all">Set the redirect URI to: <code className="bg-gray-700 px-1 rounded text-xs text-gray-200">https://partyplaylist.mpdee.co.uk/api/spotify/callback</code></li>
            <li>Click &quot;Connect Spotify Account&quot; above to authenticate</li>
            <li>Create or select a playlist for approved songs</li>
            <li>Start playing music on any device to enable queue control</li>
          </ol>
        </div>
      </div>
    </div>
  );
}