'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface Request {
  id: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  requester_nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'queued' | 'failed';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
}

interface PlaybackState {
  is_playing: boolean;
  current_track?: {
    name: string;
    artists: string[];
    album: string;
    duration_ms: number;
    progress_ms: number;
    uri: string;
  };
  device?: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
  };
}

interface Stats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  today_requests: number;
  recent_requests: number;
  spotify_connected: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  
  const [token, setToken] = useState<string>('');

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
      fetchRequests();
      fetchStats();
      fetchPlaybackState();
    }
  }, []);

  // Login function
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const response = await axios.post(`${API_BASE}/admin/login`, {
        username,
        password
      });

      const { token: authToken } = response.data;
      setToken(authToken);
      localStorage.setItem('admin_token', authToken);
      setIsAuthenticated(true);
      
      // Fetch initial data
      fetchRequests();
      fetchStats();
      fetchPlaybackState();
    } catch (error: any) {
      setLoginError(error.response?.data?.error || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  // Fetch requests
  const fetchRequests = async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/admin/requests`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: filter === 'all' ? undefined : filter, limit: 100 }
      });
      setRequests(response.data.requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch playback state
  const fetchPlaybackState = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE}/admin/queue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaybackState(response.data);
    } catch (error) {
      console.error('Error fetching playback state:', error);
    }
  };

  // Approve request
  const approveRequest = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/admin/approve/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRequests();
      fetchStats();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  // Reject request
  const rejectRequest = async (id: string, reason?: string) => {
    try {
      await axios.post(`${API_BASE}/admin/reject/${id}`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRequests();
      fetchStats();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  // Skip track
  const skipTrack = async () => {
    try {
      await axios.post(`${API_BASE}/admin/playback/skip`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeout(fetchPlaybackState, 1000); // Refresh after a delay
    } catch (error) {
      console.error('Error skipping track:', error);
    }
  };

  // Pause/Resume playback
  const togglePlayback = async () => {
    try {
      const endpoint = playbackState?.is_playing ? 'pause' : 'resume';
      await axios.post(`${API_BASE}/admin/playback/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeout(fetchPlaybackState, 1000);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Auto-refresh data
  useEffect(() => {
    if (isAuthenticated && token) {
      const interval = setInterval(() => {
        fetchRequests();
        fetchPlaybackState();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, filter]);

  // Update requests when filter changes
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchRequests();
    }
  }, [filter]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🎛️ Admin Login</h1>
            <p className="text-gray-600 mt-2">Access the DJ control panel</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {loginError && (
              <div className="mb-4 text-red-600 text-sm">{loginError}</div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg"
            >
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">🎛️ DJ Control Panel</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.pending_requests}</div>
              <div className="text-gray-600">Pending</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.approved_requests}</div>
              <div className="text-gray-600">Approved</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.today_requests}</div>
              <div className="text-gray-600">Today</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.total_requests}</div>
              <div className="text-gray-600">Total</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Playback */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">🎵 Now Playing</h2>
              
              {playbackState?.current_track ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{playbackState.current_track.name}</h3>
                    <p className="text-gray-600">{playbackState.current_track.artists.join(', ')}</p>
                    <p className="text-gray-500 text-sm">{playbackState.current_track.album}</p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={togglePlayback}
                      className={`px-4 py-2 rounded-lg text-white font-semibold ${
                        playbackState.is_playing 
                          ? 'bg-yellow-500 hover:bg-yellow-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {playbackState.is_playing ? '⏸️ Pause' : '▶️ Play'}
                    </button>
                    
                    <button
                      onClick={skipTrack}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
                    >
                      ⏭️ Skip
                    </button>
                  </div>

                  {playbackState.device && (
                    <div className="text-sm text-gray-500">
                      📱 {playbackState.device.name} ({playbackState.device.type})
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  No active playback
                </div>
              )}
            </div>
          </div>

          {/* Requests List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">📋 Song Requests</h2>
                
                <div className="flex space-x-2">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        filter === status
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading...</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No requests found
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className={`border rounded-lg p-4 ${
                        request.status === 'pending' ? 'border-yellow-300 bg-yellow-50' :
                        request.status === 'approved' ? 'border-green-300 bg-green-50' :
                        request.status === 'rejected' ? 'border-red-300 bg-red-50' :
                        'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold">{request.track_name}</h3>
                          <p className="text-gray-600">{request.artist_name}</p>
                          <p className="text-gray-500 text-sm">{request.album_name}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>⏱️ {formatDuration(request.duration_ms)}</span>
                            <span>📅 {formatDate(request.created_at)}</span>
                            {request.requester_nickname && (
                              <span>👤 {request.requester_nickname}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col space-y-2 ml-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            request.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-200 text-green-800' :
                            request.status === 'rejected' ? 'bg-red-200 text-red-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {request.status.toUpperCase()}
                          </span>

                          {request.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => approveRequest(request.id)}
                                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={() => rejectRequest(request.id)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                              >
                                ❌ Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}