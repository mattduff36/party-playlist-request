'use client';

import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  Settings, 
  Music, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
  Monitor
} from 'lucide-react';

interface Request {
  id: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  requester_nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'queued' | 'failed' | 'played';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
}

interface CurrentTrack {
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  progress_ms: number;
  uri: string;
  image_url?: string;
}

interface QueueItem {
  name: string;
  artists: string[];
  album: string;
  uri: string;
  image_url?: string;
}

interface PlaybackState {
  is_playing: boolean;
  current_track?: CurrentTrack;
  queue?: QueueItem[];
  device?: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
  };
  shuffle_state?: boolean;
  repeat_state?: string;
}

interface EventSettings {
  event_title: string;
  dj_name: string;
  venue_info: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  show_qr_code: boolean;
  display_refresh_interval: number;
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

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'queue' | 'settings'>('overview');
  const [requests, setRequests] = useState<Request[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  // Spotify connection state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Login function
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: 'admin', // Hardcoded username for simplicity
          password 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        setPassword('');
        // Start fetching data after successful login
        fetchData();
      } else {
        const errorData = await response.json();
        setLoginError(errorData.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setRequests([]);
    setPlaybackState(null);
    setEventSettings(null);
    setStats(null);
  };

  // Fetch all data with authentication
  const fetchData = async () => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('admin_token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [requestsRes, queueRes, settingsRes, statsRes] = await Promise.all([
        fetch('/api/admin/requests?status=pending&limit=50', { headers }),
        fetch('/api/admin/queue/details', { headers }),
        fetch('/api/admin/event-settings', { headers }),
        fetch('/api/admin/stats', { headers })
      ]);

      // Check for authentication errors (but not Spotify-related 401s)
      if (requestsRes.status === 401 || settingsRes.status === 401 || statsRes.status === 401) {
        localStorage.removeItem('admin_token');
        setIsAuthenticated(false);
        return;
      }
      
      // Handle Spotify queue 401 separately (don't log out user)
      if (queueRes.status === 401) {
        setSpotifyConnected(false);
        setPlaybackState(null);
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.requests || []);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setPlaybackState(queueData);
        // Use the spotify_connected field from the API response
        setSpotifyConnected(queueData.spotify_connected !== false);
      } else if (queueRes.status !== 401) {
        // Only set disconnected if it's not a 401 (already handled above)
        setSpotifyConnected(false);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setEventSettings(settingsData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setSpotifyConnected(statsData.spotify_connected || false);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load admin data');
    }
  };

  // Auto-refresh data when authenticated (except on settings tab)
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchData();
    
    // Auto-refresh every 10 seconds for better UX, but not on settings tab
    const interval = setInterval(() => {
      if (activeTab !== 'settings') {
        // Silent refresh - don't show loading states
        fetchData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  // Spotify connection functions
  const handleSpotifyConnect = async () => {
    setSpotifyConnecting(true);
    try {
      console.log('Attempting to connect to Spotify...');
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/spotify/auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Spotify auth response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Spotify auth data received:', { hasAuthUrl: !!data.auth_url });
        if (data.auth_url) {
          window.location.href = data.auth_url;
        } else {
          throw new Error('No auth URL received from server');
        }
      } else {
        const errorData = await response.json();
        console.error('Spotify auth error:', errorData);
        throw new Error(errorData.error || 'Failed to get Spotify auth URL');
      }
    } catch (err) {
      console.error('Error connecting to Spotify:', err);
      alert(`Failed to connect to Spotify: ${err.message}`);
    } finally {
      setSpotifyConnecting(false);
    }
  };

  const handleSpotifyDisconnect = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch('/api/spotify/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      setSpotifyConnected(false);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error disconnecting Spotify:', err);
    }
  };

  const handleSpotifyReset = async () => {
    if (!confirm('This will completely reset your Spotify connection and clear all stored authentication data. You will need to reconnect to Spotify. Continue?')) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/spotify/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Immediately update UI state
        setSpotifyConnected(false);
        setPlaybackState(null);
        
        // Force a complete refresh of all data
        setTimeout(() => {
          fetchData();
        }, 500);
        
        alert('Spotify connection reset successfully! You can now reconnect to Spotify.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset Spotify connection');
      }
    } catch (err) {
      console.error('Error resetting Spotify connection:', err);
      alert('Failed to reset Spotify connection. Please try again.');
    }
  };

  // Playback controls
  const handlePlayPause = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = playbackState?.is_playing ? '/api/admin/playback/pause' : '/api/admin/playback/resume';
      await fetch(endpoint, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error controlling playback:', err);
    }
  };

  const handleSkip = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch('/api/admin/playback/skip', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error skipping track:', err);
    }
  };

  // Request actions
  const handleApprove = async (requestId: string, playNext = false) => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/admin/approve/${requestId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ play_next: playNext })
      });
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error approving request:', err);
    }
  };

  const handleReject = async (requestId: string, reason = 'Not suitable') => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/admin/reject/${requestId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ reason })
      });
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">DJ Admin Login</h1>
            <p className="text-gray-400">Enter your admin password to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Enter admin password"
                required
              />
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-600/20 border border-red-600 rounded-lg">
                <p className="text-red-400 text-sm">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading admin panel...</div>
      </div>
    );
  }

  // Mobile Navigation
  const MobileNav = () => (
    <div className="md:hidden bg-gray-800 border-t border-gray-700 fixed bottom-0 left-0 right-0 z-50">
      <div className="flex">
        {[
          { id: 'overview', icon: Music, label: 'Overview' },
          { id: 'requests', icon: Users, label: 'Requests' },
          { id: 'queue', icon: Clock, label: 'Queue' },
          { id: 'settings', icon: Settings, label: 'Settings' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 px-2 text-center ${
              activeTab === tab.id ? 'text-purple-400 bg-gray-700' : 'text-gray-400'
            }`}
          >
            <tab.icon className="w-5 h-5 mx-auto mb-1" />
            <div className="text-xs">{tab.label}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // Desktop Sidebar
  const Sidebar = () => (
    <div className="hidden md:flex md:flex-col md:w-64 bg-gray-800 border-r border-gray-700">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">DJ Admin</h1>
        <p className="text-gray-400 text-sm mt-1">Party Control Center</p>
      </div>
      
      <nav className="flex-1 px-4">
        {[
          { id: 'overview', icon: Music, label: 'Overview' },
          { id: 'requests', icon: Users, label: 'Song Requests' },
          { id: 'queue', icon: Clock, label: 'Spotify' },
          { id: 'settings', icon: Settings, label: 'Event Settings' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`w-full flex items-center justify-between px-4 py-3 mb-2 rounded-lg text-left transition-colors ${
              activeTab === tab.id 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center">
              <tab.icon className="w-5 h-5 mr-3" />
              {tab.label}
            </div>
            {tab.id === 'requests' && stats?.pending_requests > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                {stats.pending_requests}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <a
          href="/display"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Monitor className="w-5 h-5 mr-3" />
          Display Screen
          <ExternalLink className="w-4 h-4 ml-auto" />
        </a>
      </div>
    </div>
  );

  // Overview Tab
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Spotify Connection Warning */}
      {!spotifyConnected && (
        <div className="bg-yellow-600/20 border border-yellow-600 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <div className="flex-1">
              <h3 className="text-yellow-400 font-medium">Spotify Not Connected</h3>
              <p className="text-yellow-200 text-sm mt-1">
                Connect your Spotify account to control playback and manage the queue.
              </p>
              <p className="text-yellow-300 text-xs mt-2">
                Having connection issues? Try resetting your Spotify connection first.
              </p>
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleSpotifyConnect}
                disabled={spotifyConnecting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                {spotifyConnecting ? 'Connecting...' : 'Connect Spotify'}
              </button>
              <button
                onClick={handleSpotifyReset}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition-colors"
              >
                Reset Connection
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Current Playback */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Now Playing</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePlayPause}
              className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              {playbackState?.is_playing ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={handleSkip}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {spotifyConnected ? (
          playbackState?.current_track ? (
            <div className="flex items-center space-x-4">
              {playbackState.current_track.image_url && (
                <img
                  src={playbackState.current_track.image_url}
                  alt="Album Art"
                  className="w-16 h-16 rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {playbackState.current_track.name}
                </h3>
                <p className="text-gray-400">
                  {playbackState.current_track.artists.join(', ')}
                </p>
                <p className="text-gray-500 text-sm">
                  {playbackState.current_track.album}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">
                  {formatDuration(playbackState.current_track.progress_ms)} / {formatDuration(playbackState.current_track.duration_ms)}
                </p>
                {playbackState.device && (
                  <p className="text-gray-500 text-xs flex items-center">
                    <Volume2 className="w-3 h-3 mr-1" />
                    {playbackState.device.name}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No music currently playing</p>
              <p className="text-sm">Start playing music on Spotify to see it here</p>
            </div>
          )
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Connect to Spotify to see what's playing</p>
            <button
              onClick={handleSpotifyConnect}
              className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
            >
              Connect Spotify
            </button>
          </div>
        )}
      </div>

      {/* Spotify Playlist - Next 10 Songs */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Coming Up Next</h2>
          <button
            onClick={() => setActiveTab('queue')}
            className="text-purple-400 hover:text-purple-300 text-sm"
          >
            View Full Queue →
          </button>
        </div>
        
        <div className="space-y-3">
          {spotifyConnected ? (
            playbackState?.queue && playbackState.queue.length > 0 ? (
              playbackState.queue.slice(0, 10).map((track: any, index: number) => {
                // Check if this track was requested and approved
                const matchingRequest = requests.find(req => 
                  req.status === 'approved' && 
                  (req.track_uri === track.uri || 
                   (req.track_name.toLowerCase() === track.name.toLowerCase() && 
                    req.artist_name.toLowerCase() === track.artists.join(', ').toLowerCase()))
                );
                
                return (
                  <div 
                    key={`${track.uri}-${index}`} 
                    className={`flex items-center p-3 rounded-lg ${
                      matchingRequest ? 'bg-green-600/20 border border-green-600' : 'bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <span className="text-gray-400 text-sm font-mono w-6">
                        {index + 1}
                      </span>
                      {track.image_url && (
                        <img
                          src={track.image_url}
                          alt="Album Art"
                          className="w-10 h-10 rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className={`font-medium ${matchingRequest ? 'text-green-300' : 'text-white'}`}>
                          {track.name}
                        </h4>
                        <p className="text-gray-400 text-sm">{track.artists.join(', ')}</p>
                        {matchingRequest && (
                          <p className="text-green-400 text-xs">
                            ✓ Requested by {matchingRequest.requester_nickname || 'Anonymous'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-400 text-sm">
                      {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No upcoming songs in queue</p>
                <p className="text-sm">Add songs to your Spotify queue to see them here</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Connect to Spotify to see upcoming songs</p>
              <button
                onClick={handleSpotifyConnect}
                className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
              >
                Connect Spotify
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Requests Tab
  const RequestsTab = () => {
    const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'played' | 'all'>('all');
    const [allRequests, setAllRequests] = useState<Request[]>([]);

    // Fetch requests based on filter
    useEffect(() => {
      const fetchRequests = async () => {
        try {
          const token = localStorage.getItem('admin_token');
          const url = filterStatus === 'all' 
            ? '/api/admin/requests?limit=100'
            : `/api/admin/requests?status=${filterStatus}&limit=100`;
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            const data = await response.json();
            let requests = data.requests || [];
            
            // Sort requests when showing all: Approved > Pending > Played > Rejected
            if (filterStatus === 'all') {
              const statusOrder = { 'approved': 1, 'pending': 2, 'played': 3, 'rejected': 4 };
              requests = requests.sort((a: Request, b: Request) => {
                const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 5;
                const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 5;
                if (aOrder !== bOrder) return aOrder - bOrder;
                // Within same status, sort by created_at (newest first)
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
            }
            
            setAllRequests(requests);
          }
        } catch (err) {
          console.error('Error fetching requests:', err);
        }
      };

      fetchRequests();
    }, [filterStatus]);

    const handleSelectAll = () => {
      if (selectedRequests.length === allRequests.length) {
        setSelectedRequests([]);
      } else {
        setSelectedRequests(allRequests.map(r => r.id));
      }
    };

    const handleSelectRequest = (requestId: string) => {
      setSelectedRequests(prev => 
        prev.includes(requestId) 
          ? prev.filter(id => id !== requestId)
          : [...prev, requestId]
      );
    };

    const handleBulkApprove = async () => {
      for (const requestId of selectedRequests) {
        await handleApprove(requestId);
      }
      setSelectedRequests([]);
      // Refresh requests
      const token = localStorage.getItem('admin_token');
      const url = filterStatus === 'all' 
        ? '/api/admin/requests?limit=100'
        : `/api/admin/requests?status=${filterStatus}&limit=100`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllRequests(data.requests || []);
      }
    };

    const handleBulkReject = async () => {
      for (const requestId of selectedRequests) {
        await handleReject(requestId, 'Bulk rejection');
      }
      setSelectedRequests([]);
      // Refresh requests
      const token = localStorage.getItem('admin_token');
      const url = filterStatus === 'all' 
        ? '/api/admin/requests?limit=100'
        : `/api/admin/requests?status=${filterStatus}&limit=100`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllRequests(data.requests || []);
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'text-yellow-400 bg-yellow-400/10';
        case 'approved': return 'text-green-400 bg-green-400/10';
        case 'played': return 'text-purple-400 bg-purple-400/10';
        case 'rejected': return 'text-red-400 bg-red-400/10';
        case 'failed': return 'text-orange-400 bg-orange-400/10';
        default: return 'text-gray-400 bg-gray-400/10';
      }
    };

    return (
      <div className="space-y-6">
        {/* Header with filters and bulk actions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Song Requests</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Requests (Ordered)</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending ({requests.length})</option>
                  <option value="played">Played</option>
                  <option value="rejected">Rejected</option>
                </select>
                
                {allRequests.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    {selectedRequests.length === allRequests.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
            </div>

            {selectedRequests.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">
                  {selectedRequests.length} selected
                </span>
                <button
                  onClick={handleBulkApprove}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve All</span>
                </button>
                <button
                  onClick={handleBulkReject}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject All</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {allRequests.length === 0 ? (
            <div className="p-8 text-center">
              <Music className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {allRequests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedRequests.includes(request.id)}
                      onChange={() => handleSelectRequest(request.id)}
                      className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                    />

                    {/* Album Art Placeholder */}
                    <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                      <Music className="w-6 h-6 text-gray-400" />
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="text-white font-medium truncate">
                          {request.track_name}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      
                      <p className="text-gray-400 text-sm truncate">
                        {request.artist_name} • {request.album_name}
                      </p>
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>{formatDuration(request.duration_ms)}</span>
                        <span>{formatTimeAgo(request.created_at)}</span>
                        {request.requester_nickname && (
                          <span className="text-purple-300">
                            by {request.requester_nickname}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(request.id, true)}
                            className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors group"
                            title="Play Next"
                          >
                            <PlayCircle className="w-4 h-4 text-white" />
                          </button>
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            title="Add to Queue"
                          >
                            <CheckCircle className="w-4 h-4 text-white" />
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4 text-white" />
                          </button>
                        </>
                      )}
                      
                      {request.status === 'approved' && (
                        <div className="flex items-center space-x-2 text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          <span>Approved</span>
                          {request.approved_by && (
                            <span className="text-gray-500">by {request.approved_by}</span>
                          )}
                        </div>
                      )}
                      
                      {request.status === 'rejected' && (
                        <>
                          <div className="flex items-center space-x-2 text-red-400 text-sm">
                            <XCircle className="w-4 h-4" />
                            <span>Rejected</span>
                            {request.rejection_reason && (
                              <span className="text-gray-500" title={request.rejection_reason}>
                                ({request.rejection_reason})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 ml-4">
                            <button
                              onClick={() => handleApprove(request.id, true)}
                              className="p-1 bg-green-600 hover:bg-green-700 rounded text-white text-xs"
                              title="Play Next"
                            >
                              <PlayCircle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleApprove(request.id)}
                              className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs"
                              title="Add to Queue"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                      
                      {request.status === 'played' && (
                        <>
                          <div className="flex items-center space-x-2 text-purple-400 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>Played</span>
                          </div>
                          <div className="flex items-center space-x-1 ml-4">
                            <button
                              onClick={() => handleApprove(request.id, true)}
                              className="p-1 bg-green-600 hover:bg-green-700 rounded text-white text-xs"
                              title="Play Next"
                            >
                              <PlayCircle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleApprove(request.id)}
                              className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs"
                              title="Add to Queue"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}

                      <button
                        onClick={() => window.open(`https://open.spotify.com/track/${request.track_uri.split(':')[2]}`, '_blank')}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title="Open in Spotify"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Queue Tab
  const QueueTab = () => {
    const [detailedQueue, setDetailedQueue] = useState<any>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    // Fetch detailed queue information
    useEffect(() => {
      const fetchDetailedQueue = async (isInitial = false) => {
        try {
          const token = localStorage.getItem('admin_token');
          const response = await fetch('/api/admin/queue/details', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            const data = await response.json();
            setDetailedQueue(data);
          }
        } catch (err) {
          console.error('Error fetching detailed queue:', err);
        } finally {
          if (isInitial) {
            setInitialLoading(false);
          }
        }
      };

      fetchDetailedQueue(true);
      
      // Auto-refresh every 10 seconds (silently)
      const interval = setInterval(() => fetchDetailedQueue(false), 10000);
      return () => clearInterval(interval);
    }, []);

    if (initialLoading) {
      return (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-gray-400">Loading Spotify interface...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Current Track */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Music className="w-6 h-6 mr-2" />
            Now Playing
          </h2>
          
          {detailedQueue?.current_track ? (
            <div className="flex items-center space-x-4">
              {detailedQueue.current_track.image_url && (
                <img
                  src={detailedQueue.current_track.image_url}
                  alt="Album Art"
                  className="w-20 h-20 rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-1">
                  {detailedQueue.current_track.name}
                </h3>
                <p className="text-gray-400 mb-2">
                  {detailedQueue.current_track.artists.join(', ')}
                </p>
                <p className="text-gray-500 text-sm mb-3">
                  {detailedQueue.current_track.album}
                </p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: `${(detailedQueue.current_track.progress_ms / detailedQueue.current_track.duration_ms) * 100}%`
                    }}
                  />
                </div>
                
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{formatDuration(detailedQueue.current_track.progress_ms)}</span>
                  <span>{formatDuration(detailedQueue.current_track.duration_ms)}</span>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handlePlayPause}
                  className="p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  {detailedQueue.is_playing ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white" />
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <SkipForward className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No music currently playing</p>
            </div>
          )}
        </div>

        {/* Device Info */}
        {detailedQueue?.device && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{detailedQueue.device.name}</p>
                  <p className="text-gray-400 text-sm">{detailedQueue.device.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Volume</p>
                <p className="text-white font-medium">{detailedQueue.device.volume_percent}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Spotify Queue */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Clock className="w-6 h-6 mr-2" />
              Spotify Queue
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              {detailedQueue?.shuffle_state && (
                <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded">
                  Shuffle ON
                </span>
              )}
              {detailedQueue?.repeat_state !== 'off' && (
                <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded">
                  Repeat {detailedQueue.repeat_state}
                </span>
              )}
            </div>
          </div>

          {detailedQueue?.queue && detailedQueue.queue.length > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm mb-4">
                {detailedQueue.queue.length} songs in queue
              </p>
              
              {detailedQueue.queue.slice(0, 10).map((track: any, index: number) => (
                <div 
                  key={`${track.uri}-${index}`}
                  className="flex items-center space-x-4 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="text-gray-400 font-medium w-8 text-center">
                    {index + 1}
                  </div>
                  
                  {track.image_url && (
                    <img
                      src={track.image_url}
                      alt="Album Art"
                      className="w-12 h-12 rounded-lg"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">
                      {track.name}
                    </h4>
                    <p className="text-gray-400 text-sm truncate">
                      {track.artists.join(', ')}
                    </p>
                    <p className="text-gray-500 text-xs truncate">
                      {track.album}
                    </p>
                  </div>
                  
                  <div className="text-gray-400 text-sm">
                    {formatDuration(track.duration_ms)}
                  </div>
                  
                  <button
                    onClick={() => window.open(`https://open.spotify.com/track/${track.uri.split(':')[2]}`, '_blank')}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Open in Spotify"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {detailedQueue.queue.length > 10 && (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm">
                    ... and {detailedQueue.queue.length - 10} more songs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No songs in queue</p>
              <p className="text-sm mt-1">Approved requests will appear here</p>
            </div>
          )}
        </div>

        {/* Queue Actions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Queue Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleSkip}
              className="flex items-center justify-center space-x-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5" />
              <span>Skip Current</span>
            </button>
            
            <button
              onClick={() => window.open('https://open.spotify.com/queue', '_blank')}
              className="flex items-center justify-center space-x-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              <span>Open Spotify Queue</span>
            </button>
            
            <button
              onClick={() => fetchData()}
              className="flex items-center justify-center space-x-2 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Settings Tab
  const SettingsTab = () => {
    const [formData, setFormData] = useState<EventSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // Initialize form data when eventSettings loads
    useEffect(() => {
      if (eventSettings) {
        setFormData({ ...eventSettings });
      }
    }, [eventSettings]);

    const handleInputChange = (field: keyof EventSettings, value: string | boolean | number) => {
      if (formData) {
        setFormData({
          ...formData,
          [field]: value
        });
      }
    };

    const handleSave = async () => {
      if (!formData) return;

      setSaving(true);
      setSaveMessage(null);

      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/event-settings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          const result = await response.json();
          setEventSettings(result.settings);
          setSaveMessage('Settings saved successfully!');
          
          // Clear message after 3 seconds
          setTimeout(() => setSaveMessage(null), 3000);
        } else {
          setSaveMessage('Failed to save settings');
        }
      } catch (err) {
        console.error('Error saving settings:', err);
        setSaveMessage('Error saving settings');
      } finally {
        setSaving(false);
      }
    };

    if (!formData) {
      return (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-gray-400">Loading settings...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Event Information */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Settings className="w-6 h-6 mr-2" />
            Event Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Title
              </label>
              <input
                type="text"
                value={formData.event_title}
                onChange={(e) => handleInputChange('event_title', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Party DJ Requests"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                DJ Name
              </label>
              <input
                type="text"
                value={formData.dj_name}
                onChange={(e) => handleInputChange('dj_name', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="DJ Name (optional)"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Venue Information
              </label>
              <input
                type="text"
                value={formData.venue_info}
                onChange={(e) => handleInputChange('venue_info', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Venue name or location (optional)"
              />
            </div>
          </div>
        </div>

        {/* Display Messages */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Display Screen Messages</h3>
          <p className="text-gray-400 text-sm mb-6">
            These messages will rotate on the display screen. Leave empty to hide a message.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Welcome Message (Primary)
              </label>
              <input
                type="text"
                value={formData.welcome_message}
                onChange={(e) => handleInputChange('welcome_message', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Request your favorite songs!"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Secondary Message
              </label>
              <input
                type="text"
                value={formData.secondary_message}
                onChange={(e) => handleInputChange('secondary_message', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Your requests will be reviewed by the DJ"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tertiary Message
              </label>
              <input
                type="text"
                value={formData.tertiary_message}
                onChange={(e) => handleInputChange('tertiary_message', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Keep the party going!"
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Display Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Refresh Interval (seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={formData.display_refresh_interval}
                onChange={(e) => handleInputChange('display_refresh_interval', parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                How often the display screen updates (5-300 seconds)
              </p>
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_qr_code}
                  onChange={(e) => handleInputChange('show_qr_code', e.target.checked)}
                  className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="text-white font-medium">Show QR Code</span>
                  <p className="text-gray-400 text-sm">Display QR code for song requests</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Save Changes</h3>
              <p className="text-gray-400 text-sm">
                Changes will be applied to the display screen immediately
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {saveMessage && (
                <span className={`text-sm ${
                  saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {saveMessage}
                </span>
              )}
              
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Preview Link */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Display Screen Preview</h3>
          <p className="text-gray-400 mb-4">
            Test your settings on the display screen
          </p>
          
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Monitor className="w-5 h-5" />
            <span>Open Display Screen</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'requests': return <RequestsTab />;
      case 'queue': return <QueueTab />;
      case 'settings': return <SettingsTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white md:hidden">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <div className="hidden md:block">
                <h1 className="text-2xl font-bold text-white">
                  {eventSettings?.event_title || 'Party DJ Admin'}
                </h1>
                {eventSettings?.dj_name && (
                  <p className="text-gray-400">DJ {eventSettings.dj_name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${spotifyConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-gray-400 text-sm">
                  {spotifyConnected ? 'Spotify Connected' : 'Spotify Disconnected'}
                </span>
                
                {!spotifyConnected && (
                  <button
                    onClick={handleSpotifyConnect}
                    disabled={spotifyConnecting}
                    className="ml-2 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                  >
                    {spotifyConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                )}
                
                {spotifyConnected && (
                  <button
                    onClick={handleSpotifyDisconnect}
                    className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                
                {/* Reset button - always available for troubleshooting */}
                <button
                  onClick={handleSpotifyReset}
                  className="ml-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
                  title="Reset Spotify connection and clear all stored authentication data"
                >
                  Reset
                </button>
              </div>
              
              <button
                onClick={fetchData}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 pb-20 md:pb-6 overflow-y-auto">
          {renderActiveTab()}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}