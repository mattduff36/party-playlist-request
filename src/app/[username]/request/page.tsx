'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { usePusher } from '@/hooks/usePusher';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { EventConfig } from '@/lib/db/schema';
import { Music2, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  image?: string;
}

interface SearchResult {
  tracks: Track[];
  query: string;
  total: number;
}

interface RequestResponse {
  success: boolean;
  message: string;
  request?: {
    id: string;
    track: {
      name: string;
      artists: string[];
      album: string;
    };
  };
}

const API_BASE = '/api';

// Helper function to format duration
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function UserRequestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const bypassToken = searchParams.get('bt');

  // PIN Authentication State
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Request Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [eventSettings, setEventSettings] = useState<EventConfig | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Use global event state
  const { state: globalState } = useGlobalEvent();
  
  // User session and notification states
  const [userSessionId] = useState(() => {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  });
  const [userRequests, setUserRequests] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'approved' | 'play_next';
    trackName: string;
    artistName: string;
    timestamp: number;
  }>>([]);

  // Auto-verify if bypass token is present
  useEffect(() => {
    if (bypassToken) {
      verifyAccess(undefined, bypassToken);
    }
  }, [bypassToken]);

  // Check session storage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(`event_auth_${username}`);
    if (stored) {
      try {
        const auth = JSON.parse(stored);
        if (Date.now() - auth.timestamp < 24 * 60 * 60 * 1000) {
          setAuthenticated(true);
        }
      } catch (e) {
        sessionStorage.removeItem(`event_auth_${username}`);
      }
    }
  }, [username]);

  const verifyAccess = async (pinValue?: string, token?: string) => {
    setVerifying(true);
    setPinError('');

    try {
      const response = await fetch('/api/events/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          pin: pinValue,
          bypassToken: token
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAuthenticated(true);
        sessionStorage.setItem(`event_auth_${username}`, JSON.stringify({
          eventId: data.event.id,
          authMethod: data.authMethod,
          timestamp: Date.now()
        }));
      } else {
        setPinError(data.error || 'Access denied');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setPinError('Connection error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      verifyAccess(pin);
    } else {
      setPinError('PIN must be 4 digits');
    }
  };

  // Handle clicking anywhere to dismiss notifications
  useEffect(() => {
    const handleGlobalClick = () => {
      if (notifications.length > 0) {
        setNotifications([]);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [notifications.length]);

  // Listen for request updates via Pusher
  usePusher({
    username: username, // Pass username for userId lookup on public pages
    onPageControlToggle: (data: any) => {
      console.log('🔄 Page control changed via Pusher:', data);
    },
    onRequestApproved: (data: any) => {
      console.log('🎉 Request approved via Pusher:', data);
      
      if (data.user_session_id === userSessionId || userRequests.has(data.id)) {
        console.log('✅ This is our request! Adding notification...');
        
        const notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: data.play_next ? 'play_next' : 'approved' as 'approved' | 'play_next',
          trackName: data.track_name,
          artistName: data.artist_name,
          timestamp: Date.now()
        };
        
        setNotifications(prev => [...prev, notification]);
        
        setUserRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.id);
          return newSet;
        });
      }
    },
    onSettingsUpdate: (data: any) => {
      console.log('⚙️ PUSHER: Settings updated!', data);
      if (data.settings) {
        setEventSettings(data.settings);
      }
    }
  });

  // Fetch event settings
  const fetchEventSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE}/public/event-config`, {
        params: { username }
      });
      if (response.data.config) {
        setEventSettings(response.data.config);
      }
    } catch (error) {
      console.error('Error fetching event settings:', error);
      setEventSettings({
        event_title: 'Party DJ Requests',
        welcome_message: 'Request your favorite songs and let\'s keep the party going!',
        secondary_message: '',
        tertiary_message: '',
        show_qr_code: true,
        display_refresh_interval: 20
      });
    }
  };

  // Load nickname from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`nickname_${username}`);
    if (saved) setNickname(saved);
  }, [username]);

  // Save nickname to localStorage
  useEffect(() => {
    if (nickname) {
      localStorage.setItem(`nickname_${username}`, nickname);
    }
  }, [nickname, username]);

  // Set mounted flag
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch event settings on mount
  useEffect(() => {
    if (!mounted || !authenticated) return;
    fetchEventSettings();
  }, [mounted, authenticated, username]);

  // Check if query is a Spotify URL
  const isSpotifyUrl = (query: string): boolean => {
    return query.includes('open.spotify.com/track/') || query.includes('spotify:track:');
  };

  // Search for tracks or handle Spotify URL
  const searchTracks = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // If it's a Spotify URL, submit directly
    if (isSpotifyUrl(query)) {
      submitRequest(undefined, query);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get<SearchResult>(`${API_BASE}/spotify/search`, {
        params: { q: query.trim(), username, limit: 20 },
        timeout: 15000
      });
      
      // Transform Spotify API response
      const transformedTracks = response.data.tracks.map((track: any) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: Array.isArray(track.artists) 
          ? (typeof track.artists[0] === 'string' ? track.artists : track.artists.map((a: any) => a.name))
          : [],
        album: typeof track.album === 'string' ? track.album : track.album?.name || 'Unknown Album',
        duration_ms: track.duration_ms,
        explicit: track.explicit || false,
        preview_url: track.preview_url,
        image: track.album?.images?.[0]?.url || track.image
      }));
      
      setSearchResults(transformedTracks);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery && nickname.trim() && authenticated) {
        searchTracks(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, nickname, authenticated]);

  // Submit request
  const submitRequest = async (track?: Track, url?: string) => {
    if (!nickname || !nickname.trim()) {
      setRequestStatus('error');
      setStatusMessage('Please enter your name before making a request.');
      return;
    }

    setIsSubmitting(true);
    setRequestStatus('idle');

    try {
      const requestData: any = {
        requester_nickname: nickname.trim(),
        user_session_id: userSessionId,
        username // Pass username for multi-tenancy
      };

      if (track) {
        requestData.track_uri = track.uri;
        requestData.track_name = track.name;
        requestData.artist_name = track.artists.join(', ');
        requestData.album_name = track.album;
        requestData.duration_ms = track.duration_ms;
      } else if (url) {
        requestData.track_url = url;
      } else {
        throw new Error('No track or URL provided');
      }

      const response = await axios.post<RequestResponse>(`${API_BASE}/request`, requestData, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.data.success) {
        setRequestStatus('success');
        setStatusMessage(response.data.message);
        
        if (response.data.request?.id) {
          setUserRequests(prev => new Set([...prev, response.data.request!.id]));
        }
        
        setSearchQuery('');
        setSearchResults([]);
        
        setTimeout(() => setRequestStatus('idle'), 1000);
      }
    } catch (error: any) {
      console.error('Request submission error:', error);
      setRequestStatus('error');
      
      let errorMessage = 'Failed to submit request. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Request timeout or network error. Please check your connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      setStatusMessage(errorMessage);
      setTimeout(() => setRequestStatus('idle'), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic theme colors
  const themeColors = {
    primary: (eventSettings as any)?.theme_primary_color || '#9333ea',
    secondary: (eventSettings as any)?.theme_secondary_color || '#3b82f6',
    tertiary: (eventSettings as any)?.theme_tertiary_color || '#4f46e5',
  };
  
  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${themeColors.primary}, ${themeColors.secondary}, ${themeColors.tertiary})`
  };

  // PIN Entry Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={gradientStyle}>
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl shadow-2xl p-8 border border-white/20">
          <div className="flex flex-col items-center mb-8">
            <Music2 className="h-16 w-16 text-yellow-400 mb-4" />
            <h1 className="text-3xl font-bold text-center text-white">
              {username}'s Party Playlist
            </h1>
            <p className="text-gray-300 text-center mt-2">
              Enter the 4-digit PIN to request songs
            </p>
          </div>

          {pinError && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center mb-6">
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div>
              <label htmlFor="pin" className="block text-gray-300 text-sm font-medium mb-2">
                <Lock className="inline h-4 w-4 mr-2" />
                Event PIN
              </label>
              <input
                type="text"
                id="pin"
                maxLength={4}
                pattern="[0-9]{4}"
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-white text-center text-2xl tracking-widest font-mono"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(value);
                  setPinError('');
                }}
                disabled={verifying}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={verifying || pin.length !== 4}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-5 w-5" />
                  Access Playlist
                </>
              )}
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-6">
            PIN displayed on the DJ's screen
          </p>
        </div>
      </div>
    );
  }

  // Check event status and page controls BEFORE showing form
  if (authenticated && globalState) {
    // Event is offline
    if (globalState.status === 'offline') {
      return (
        <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
          <div className="bg-white/10 backdrop-blur-md p-12 rounded-2xl max-w-md w-full mx-4 text-center">
            <div className="text-6xl mb-6">🎵</div>
            <h1 className="text-3xl font-bold text-white mb-4">Party Not Started</h1>
            <p className="text-gray-300 mb-4">
              The DJ hasn't started the party yet. Check back soon!
            </p>
            <p className="text-sm text-gray-400">@{username}</p>
          </div>
        </div>
      );
    }

    // Requests page is disabled
    if (!globalState.pagesEnabled?.requests) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
          <div className="bg-white/10 backdrop-blur-md p-12 rounded-2xl max-w-md w-full mx-4 text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-3xl font-bold text-white mb-4">Requests Disabled</h1>
            <p className="text-gray-300 mb-4">
              The DJ has temporarily disabled song requests. Check back later!
            </p>
            <p className="text-sm text-gray-400">@{username}</p>
          </div>
        </div>
      );
    }
  }

  // Main Request Form (after authentication and checks passed)
  return (
    <div className="min-h-screen relative" style={gradientStyle}>
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="text-center pt-4 pb-1">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 text-yellow-400 text-4xl">🎵</div>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">
            {eventSettings?.event_title || 'Party DJ Requests'}
          </h1>
          <p className="text-sm text-gray-400 mb-2">
            {eventSettings?.welcome_message || 'Request your favorite songs and let\'s keep the party going!'}
          </p>
        </div>

        {/* Status Messages */}
        {requestStatus === 'success' && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-green-500 text-white px-8 py-6 rounded-2xl shadow-2xl border-4 border-green-400 max-w-md mx-4 transform animate-bounce">
              <div className="flex items-center justify-center">
                <span className="text-4xl mr-4">✅</span>
                <span className="text-xl font-bold text-center">{statusMessage}</span>
              </div>
            </div>
          </div>
        )}

        {requestStatus === 'error' && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-red-500 text-white px-8 py-6 rounded-2xl shadow-2xl border-4 border-red-400 max-w-md mx-4 transform animate-pulse">
              <div className="flex items-center justify-center">
                <span className="text-4xl mr-4">❌</span>
                <span className="text-xl font-bold text-center">{statusMessage}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex items-start justify-center px-4 py-8 pt-16">
          <div className="max-w-xl w-full space-y-6">
            {/* Name Input */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">👤 Your Name</h2>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your name..."
                className="w-full px-4 py-3 text-lg bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                required
              />
            </div>

            {/* Search Section */}
            <div className={`bg-white/10 backdrop-blur-md rounded-lg p-6 transition-opacity ${!nickname.trim() ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-2xl font-bold text-white mb-4">🔍 Search for Songs</h2>
              
              {!nickname.trim() && (
                <div className="text-center py-4 mb-4">
                  <p className="text-gray-300 text-sm">Please enter your name first to search for songs</p>
                </div>
              )}
              
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={nickname.trim() ? "Search by song title, artist, album, or paste Spotify link..." : "Enter your name first..."}
                  className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  disabled={!nickname.trim()}
                />
              </div>

              {isSearching && nickname.trim() && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto"></div>
                  <p className="text-gray-300 mt-2">Searching...</p>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && nickname.trim() && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="bg-white/20 rounded-lg p-4 hover:bg-white/30 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        {track.image && (
                          <img
                            src={track.image}
                            alt={track.album}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">
                            {track.name}
                            {track.explicit && (
                              <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded">
                                EXPLICIT
                              </span>
                            )}
                          </h3>
                          <p className="text-gray-300 text-sm truncate">
                            {track.artists.join(', ')} • {track.album}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {formatDuration(track.duration_ms)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            submitRequest(track);
                          }}
                          disabled={isSubmitting || !nickname.trim()}
                          className="bg-yellow-400 hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center text-gray-300 px-4 pb-8">
        <p className="mb-2">
          💡 <strong>Tip:</strong> Search for songs by title, artist, or paste Spotify links directly
        </p>
        <p className="text-sm">
          {eventSettings?.secondary_message || 'Your requests will be reviewed by the DJ before being added to the queue'}
        </p>
      </div>
      
      {/* Notification Toasts */}
      <div className="fixed top-6 right-6 z-50 space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              transform transition-all duration-500 ease-in-out
              bg-gradient-to-r ${
                notification.type === 'play_next' 
                  ? 'from-green-500 to-emerald-600' 
                  : 'from-blue-500 to-purple-600'
              }
              text-white px-8 py-6 rounded-xl shadow-2xl max-w-md min-w-[320px]
              animate-slide-in-right border-2 border-white/20
            `}
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                {notification.type === 'play_next' ? (
                  <div className="w-10 h-10 text-4xl flex items-center justify-center">⚡</div>
                ) : (
                  <div className="w-10 h-10 text-4xl flex items-center justify-center">✅</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg mb-1">
                  {notification.type === 'play_next' ? 'Playing Next!' : 'Request Approved!'}
                </div>
                <div className="text-base opacity-95 font-medium truncate">
                  {notification.trackName}
                </div>
                <div className="text-sm opacity-80 truncate">
                  by {notification.artistName}
                </div>
                <div className="text-xs opacity-60 mt-2">
                  Click anywhere to dismiss
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Debug footer */}
      <div className="fixed bottom-2 left-2 text-gray-500 text-xs bg-black/20 px-2 py-1 rounded">
        @{username}
      </div>
    </div>
  );
}