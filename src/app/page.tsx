'use client';

import { useState, useEffect } from 'react';
// Using simple icons instead of heroicons for now
import axios from 'axios';
import { usePusher } from '@/hooks/usePusher';
import PartyNotStarted from '@/components/PartyNotStarted';

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

interface EventSettings {
  event_title: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  show_qr_code: boolean;
  display_refresh_interval: number;
  // Polling intervals (in seconds) - optional for compatibility
  admin_polling_interval?: number;
  display_polling_interval?: number;
  now_playing_polling_interval?: number;
  sse_update_interval?: number;
}

const API_BASE = '/api';

// Helper function to format duration
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [partyActive, setPartyActive] = useState(true); // Default to true to avoid flash
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean | null>(null); // null = loading, true/false = loaded
  const [requestsPageEnabled, setRequestsPageEnabled] = useState<boolean | null>(null); // null = loading, true/false = loaded
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null); // Pusher stats to check global party status
  
  // User session and notification states
  const [userSessionId] = useState(() => {
    // Generate unique session ID for this user
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

  // Listen for page control changes and request updates via Pusher
  usePusher({
    onPageControlToggle: (data: any) => {
      console.log('🔄 Page control changed via Pusher:', data);
      fetchPartyStatus();
      fetchPageControls(); // Refresh page controls and admin status
    },
    onAdminLogin: (data: any) => {
      console.log('🔐 Admin login via Pusher:', data);
      // Add small delay to allow admin panel to finish storing token
      setTimeout(() => {
        fetchPageControls(); // Refresh admin status and page controls
      }, 100);
    },
    onAdminLogout: (data: any) => {
      console.log('🔐 Admin logout via Pusher:', data);
      // Add small delay to allow admin panel to finish clearing token
      setTimeout(() => {
        fetchPageControls(); // Refresh admin status and page controls
      }, 100);
    },
    onRequestApproved: (data: any) => {
      console.log('🎉 Request approved via Pusher:', data);
      
      // Check if this request belongs to the current user
      if (data.user_session_id === userSessionId || userRequests.has(data.id)) {
        console.log('✅ This is our request! Adding notification...');
        
        // Add notification for the user
        const notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: data.play_next ? 'play_next' : 'approved' as 'approved' | 'play_next',
          trackName: data.track_name,
          artistName: data.artist_name,
          timestamp: Date.now()
        };
        
        setNotifications(prev => [...prev, notification]);
        
        // Note: Notifications now stay until user clicks anywhere on screen
        
        // Remove from user requests set since it's been processed
        setUserRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.id);
          return newSet;
        });
      }
    },
    onStatsUpdate: (data: any) => {
      console.log('📊 Stats update via Pusher:', data);
      setStats(data);
    }
  });

  // Fetch event settings and party status
  const fetchEventSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE}/display/current`);
      if (response.data.event_settings) {
        setEventSettings(response.data.event_settings);
      }
    } catch (error) {
      console.error('Error fetching event settings:', error);
      // Set default settings if fetch fails
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

  const fetchPartyStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/party-status`);
      setPartyActive(response.data.party_active);
    } catch (error) {
      console.error('Error fetching party status:', error);
      setPartyActive(false);
    }
  };

  const fetchAdminLoginStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/login-status`);
      if (response.ok) {
        const data = await response.json();
        setAdminLoggedIn(data.admin_logged_in);
      } else {
        setAdminLoggedIn(false);
      }
    } catch (error) {
      console.error('Error fetching admin login status:', error);
      setAdminLoggedIn(false);
    }
  };

  const fetchPageControls = async () => {
    try {
      // Check if there's an admin token - if not, this is a regular user
      const token = localStorage.getItem('admin_token');
      console.log('🔑 HomePage: Admin token found:', !!token);
      
      if (!token) {
        console.log('👤 HomePage: No admin token - this is a regular user, skipping admin checks');
        setAdminLoggedIn(false);
        setRequestsPageEnabled(null); // Not applicable for regular users
        return;
      }
      
      console.log('🔄 HomePage: Admin token found - checking admin status...');
      
      // Check admin login status
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`
      };
      
      const response = await fetch(`${API_BASE}/admin/login-status`, { headers });
      console.log('🌐 HomePage: Login API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 HomePage: Admin login data:', data);
        setAdminLoggedIn(data.admin_logged_in);
        
        // If admin is logged in, also fetch page controls
        if (data.admin_logged_in) {
          console.log('✅ HomePage: Admin logged in, fetching page controls...');
          const controlsResponse = await fetch(`${API_BASE}/admin/page-controls`, { headers });
          if (controlsResponse.ok) {
            const controlsData = await controlsResponse.json();
            console.log('📊 HomePage: Page controls data:', controlsData);
            setRequestsPageEnabled(controlsData.requests_page_enabled);
          } else {
            console.error('❌ HomePage: Failed to fetch page controls:', controlsResponse.status);
            setRequestsPageEnabled(null);
          }
        } else {
          console.log('🚫 HomePage: Admin token invalid, treating as regular user');
          setRequestsPageEnabled(null);
        }
      } else {
        console.log('❌ HomePage: Login status check failed:', response.status);
        setAdminLoggedIn(false);
        setRequestsPageEnabled(null);
      }
    } catch (error) {
      console.error('Error fetching admin login status:', error);
      setAdminLoggedIn(false);
      setRequestsPageEnabled(null);
    }
  };

  // Set mounted flag when component mounts on client
  useEffect(() => {
    console.log('🚀 HomePage: useEffect running - client-side JS is working!');
    setMounted(true);
  }, []);

  // Fetch event settings, party status, and page controls on component mount
  useEffect(() => {
    if (!mounted) return;
    
    console.log('🔄 HomePage: Fetching data - mounted is true');
    console.log('🔄 HomePage: Current states:', { adminLoggedIn, requestsPageEnabled });
    fetchEventSettings();
    fetchPartyStatus();
    fetchPageControls(); // This will also check admin login status
  }, [mounted]);

  // Force initial load if states are still null after a delay
  useEffect(() => {
    if (!mounted) return;
    
    const timer = setTimeout(() => {
      if (adminLoggedIn === null) {
        console.log('🔄 Force loading page controls after timeout');
        fetchPageControls();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [adminLoggedIn, mounted]);

  // Mobile-specific timeout - if still loading after 5 seconds, assume regular user
  useEffect(() => {
    if (!mounted) return;
    
    const mobileTimeout = setTimeout(() => {
      if (adminLoggedIn === null && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        console.log('📱 Mobile timeout: Still loading after 5s, assuming regular user (no admin token)');
        setAdminLoggedIn(false);
        setRequestsPageEnabled(null); // Regular users don't need page controls
      }
    }, 5000);

    return () => clearTimeout(mobileTimeout);
  }, [adminLoggedIn, mounted]);

  // Mobile users are regular users - no special cache busting needed for admin checks
  // The MobileCacheBuster component handles general cache issues

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
      const response = await axios.get<SearchResult>(`${API_BASE}/search`, {
        params: { q: query.trim(), limit: 20 },
        timeout: 15000 // 15 second timeout for search
      });
      
      // Transform Spotify API response to match our Track interface
      const transformedTracks = response.data.tracks.map((spotifyTrack: any) => ({
        id: spotifyTrack.id,
        uri: spotifyTrack.uri,
        name: spotifyTrack.name,
        artists: spotifyTrack.artists.map((artist: any) => artist.name),
        album: spotifyTrack.album.name,
        duration_ms: spotifyTrack.duration_ms,
        explicit: spotifyTrack.explicit,
        preview_url: spotifyTrack.preview_url,
        image: spotifyTrack.album.images?.[0]?.url
      }));
      
      setSearchResults(transformedTracks);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search - only if name is entered
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery && nickname.trim()) {
        searchTracks(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, nickname]);

  // Submit request
  const submitRequest = async (track?: Track, url?: string) => {
    // Validate required fields
    if (!nickname || !nickname.trim()) {
      setRequestStatus('error');
      setStatusMessage('Please enter your name before making a request.');
      return;
    }

    setIsSubmitting(true);
    setRequestStatus('idle');

    try {
      const requestData: any = {};

      // Include nickname (now required)
      requestData.requester_nickname = nickname.trim();
      
      // Include user session ID for notification tracking
      requestData.user_session_id = userSessionId;

      if (track) {
        requestData.track_uri = track.uri;
      } else if (url) {
        requestData.track_url = url;
      } else {
        throw new Error('No track or URL provided');
      }

      const response = await axios.post<RequestResponse>(`${API_BASE}/request`, requestData, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setRequestStatus('success');
        setStatusMessage(response.data.message);
        
        // Track this request for notifications
        if (response.data.request?.id) {
          setUserRequests(prev => new Set([...prev, response.data.request!.id]));
          console.log(`📝 Tracking request ${response.data.request.id} for user ${userSessionId}`);
        }
        
        // setSelectedTrack(null);
        setSearchQuery('');
        setSearchResults([]);
        
        // Auto-hide success message after 1 second
        setTimeout(() => {
          setRequestStatus('idle');
        }, 1000);
      }
    } catch (error: any) {
      console.error('Request submission error:', error);
      setRequestStatus('error');
      
      // Handle different types of errors
      let errorMessage = 'Failed to submit request. Please try again.';
      
      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response received (timeout, network error)
        errorMessage = 'Request timeout or network error. Please check your connection and try again.';
      } else {
        // Something else happened
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      setStatusMessage(errorMessage);
      
      // Auto-hide error message after 3 seconds
      setTimeout(() => {
        setRequestStatus('idle');
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Show loading state while mounting or waiting for essential data
  // For regular users: wait for mounting and either stats OR admin status
  // For admins: wait for mounting and page controls
  const isLoadingEssentialData = !mounted || 
    (adminLoggedIn === null && stats === null) || 
    (adminLoggedIn && requestsPageEnabled === null);
    
  if (isLoadingEssentialData) {
    console.log('🔄 HomePage: Showing loading state', { mounted, adminLoggedIn, requestsPageEnabled, hasStats: !!stats });
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  // STEP 1: Check if there's an admin logged in globally
  // Priority: Local admin status > Pusher stats > fallback
  const hasGlobalAdminActivity = adminLoggedIn || (stats && stats.spotify_connected);
  
  if (!hasGlobalAdminActivity) {
    console.log('🎉 HomePage: Showing PartyNotStarted - no admin logged in globally');
    return <PartyNotStarted variant="home" />;
  }

  // STEP 2: Admin is active globally, now check if requests are disabled
  // Check the party status (which reflects admin's page control settings)
  if (!partyActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center relative">
        <div className="text-center px-4">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 text-yellow-400 text-8xl animate-pulse">🎵</div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            🎉 Requests Temporarily Disabled
          </h1>
          <p className="text-2xl text-gray-300 mb-4">
            The DJ has temporarily disabled song requests
          </p>
          <p className="text-lg text-gray-400">
            Check back in a few minutes!
          </p>
        </div>
        
        {/* Very faint admin link for beta testing - bottom right corner */}
        <a 
          href="/admin" 
          className="absolute bottom-4 right-4 w-16 h-16 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-400 text-sm opacity-20 hover:opacity-40 transition-all duration-300 border border-gray-600"
          title="Admin Access (Beta Testing)"
        >
          admin
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative">
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col">
        {/* Header - Less Prominent */}
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

        {/* Status Messages - Centered Pop-up */}
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

        {/* Hero Section Content - Positioned Higher */}
        <div className="flex-1 flex items-start justify-center px-4 py-8 pt-16">
          <div className="max-w-xl w-full space-y-6">
            {/* Name Input - Styled like other boxes */}
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

            {/* Search Section - Disabled until name is entered */}
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
                      className="bg-white/20 rounded-lg p-4 hover:bg-white/30 transition-colors cursor-pointer"
                      onClick={() => {/* setSelectedTrack(track) */}}
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
            Your requests will be reviewed by the DJ before being added to the queue
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
    </div>
  );
}