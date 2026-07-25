'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { usePusher } from '@/hooks/usePusher';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { EventConfig } from '@/lib/db/schema';
import PartyNotStarted from '@/components/PartyNotStarted';
import MoodShell from '@/components/MoodShell';
import PageLoader from '@/components/ui/PageLoader';
import { validateRequesterName } from '@/lib/profanity-filter';
import {
  SPOTIFY_SEARCH_BUSY_CODE,
  SPOTIFY_SEARCH_BUSY_MESSAGE
} from '@/lib/spotify-search-errors';
import type { SpotifySearchErrorResponse } from '@/lib/spotify-search-errors';
import {
  TrackSearch,
  RequestSubmitForm,
  PinEntryForm,
  type Track,
  type SearchResult,
  type SearchFeedback,
  type RequestResponse,
  type RequestNotification,
} from '@/components/request';

const API_BASE = '/api';

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
  const [isLoading, setIsLoading] = useState(true);

  // Request Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchFeedback, setSearchFeedback] = useState<SearchFeedback | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [isNicknameValid, setIsNicknameValid] = useState(true);
  const [eventSettings, setEventSettings] = useState<EventConfig | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Use global event state
  const { state: globalState } = useGlobalEvent();
  
  // Keyboard dismissal functionality
  const dismissKeyboard = () => {
    // Blur the active input to dismiss keyboard
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Modal handlers
  const handleMakeAnotherRequest = () => {
    setShowSuccessModal(false);
    setRequestStatus('idle');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleImDone = () => {
    setShowSuccessModal(false);
    setRequestStatus('idle');
    window.location.href = 'https://partyplaylist.co.uk/';
  };
  
  // User session and notification states
  const [userSessionId] = useState(() => {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  });
  const [userRequests, setUserRequests] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<RequestNotification[]>([]);

  // Auto-verify if bypass token is present
  useEffect(() => {
    if (bypassToken) {
      verifyAccess(undefined, bypassToken);
    }
  }, [bypassToken]);

  // Check session storage on mount
  useEffect(() => {
    const checkAuth = async () => {
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
      // Add small delay to show loading screen
      setTimeout(() => {
        setIsLoading(false);
      }, 1500);
    };

    checkAuth();
  }, [username]);

  const verifyAccess = async (pinValue?: string, token?: string) => {
    setVerifying(true);
    setPinError('');
    setIsLoading(true);

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
        // Add delay to show loading screen
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      } else {
        setPinError(data.error || 'Access denied');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setPinError('Connection error. Please try again.');
      setIsLoading(false);
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

  // Auto-dismiss notifications after 3 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications([]);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [notifications.length]);

  // Handle clicking notifications to dismiss
  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

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
        
        const notification: RequestNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: data.play_next ? 'play_next' : 'approved',
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

  // Validate nickname for profanity
  const handleNicknameChange = (newNickname: string) => {
    setNickname(newNickname);
    
    // Only validate if profanity filtering is enabled
    const filteringEnabled = eventSettings?.decline_explicit || false;
    
    if (!newNickname.trim()) {
      setNicknameError('');
      setIsNicknameValid(false);
      return;
    }
    
    const validation = validateRequesterName(newNickname, filteringEnabled);
    
    if (!validation.isValid) {
      setNicknameError(validation.reason || 'Invalid name');
      setIsNicknameValid(false);
    } else {
      setNicknameError('');
      setIsNicknameValid(true);
    }
  };

  // Load nickname from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`nickname_${username}`);
    if (saved) {
      setNickname(saved);
      // Validate loaded nickname
      const filteringEnabled = eventSettings?.decline_explicit || false;
      const validation = validateRequesterName(saved, filteringEnabled);
      setIsNicknameValid(validation.isValid);
      if (!validation.isValid) {
        setNicknameError(validation.reason || 'Invalid name');
      }
    }
  }, [username, eventSettings]);

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
      setSearchFeedback(null);
      return;
    }

    setSearchFeedback(null);

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
    } catch (error: unknown) {
      console.error('Search error:', error);
      setSearchResults([]);

      if (
        axios.isAxiosError<SpotifySearchErrorResponse>(error) &&
        (
          error.response?.status === 429 ||
          error.response?.data?.code === SPOTIFY_SEARCH_BUSY_CODE
        )
      ) {
        setSearchFeedback({
          message: error.response?.data?.error || SPOTIFY_SEARCH_BUSY_MESSAGE
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery && nickname.trim() && isNicknameValid && authenticated) {
        searchTracks(searchQuery);
      } else {
        setSearchResults([]);
        setSearchFeedback(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, nickname, isNicknameValid, authenticated]);

  // Auto-dismiss keyboard when search results load
  useEffect(() => {
    if (searchResults.length > 0 && !isSearching) {
      // Small delay to ensure results are rendered
      setTimeout(() => {
        dismissKeyboard();
      }, 100);
    }
  }, [searchResults.length, isSearching]);

  // Dismiss keyboard on scroll
  useEffect(() => {
    const handleScroll = () => {
      dismissKeyboard();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Submit request
  const submitRequest = async (track?: Track, url?: string) => {
    if (!nickname || !nickname.trim()) {
      setRequestStatus('error');
      setStatusMessage('Please enter your name before making a request.');
      return;
    }

    // Validate nickname for profanity
    const filteringEnabled = eventSettings?.decline_explicit || false;
    const validation = validateRequesterName(nickname, filteringEnabled);
    
    if (!validation.isValid) {
      setRequestStatus('error');
      setStatusMessage(validation.reason || 'Invalid name. Please choose a different name.');
      return;
    }

    setIsSubmitting(true);
    setRequestStatus('idle');

    try {
      // Use censored nickname for the request
      const requestData: any = {
        requester_nickname: validation.censoredName,
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
        setShowSuccessModal(true);
        
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

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setSearchFeedback(null);
  };

  const moodProps = {
    mood: eventSettings?.display_mood,
    legacyPrimaryColor: eventSettings?.theme_primary_color,
  };

  // Loading Screen — gate content until auth/settings ready
  if (isLoading) {
    return (
      <PageLoader
        label={verifying ? 'Verifying access...' : 'Loading request page...'}
      />
    );
  }

  // PIN Entry Screen
  if (!authenticated) {
    return (
      <MoodShell {...moodProps} className="flex flex-col items-center justify-center p-4">
        <PinEntryForm
          username={username}
          pin={pin}
          pinError={pinError}
          verifying={verifying}
          onPinChange={setPin}
          onClearPinError={() => setPinError('')}
          onSubmit={handlePinSubmit}
        />
      </MoodShell>
    );
  }

  // Check event status and page controls BEFORE showing form
  if (authenticated && globalState) {
    // Event is offline
    if (globalState.status === 'offline') {
      return <PartyNotStarted variant="request" />;
    }

    // Requests page is disabled
    if (!globalState.pagesEnabled?.requests) {
      return (
        <MoodShell {...moodProps} className="flex items-center justify-center p-4">
          <div className="mood-surface p-12 max-w-md w-full text-center">
            <h1 className="font-display text-3xl font-bold mb-4">Requests Disabled</h1>
            <p className="text-[color:var(--mood-muted)] mb-4">
              The DJ has temporarily disabled song requests. Check back later!
            </p>
            <p className="text-sm text-[color:var(--mood-muted)]">@{username}</p>
          </div>
        </MoodShell>
      );
    }
  }

  // Main Request Form (after authentication and checks passed)
  return (
    <MoodShell {...moodProps} className="relative">
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="text-center pt-3 pb-2">
          <h1 className="font-display text-xl font-semibold">
            {eventSettings?.event_title || 'Party DJ Requests'}
          </h1>
        </div>

        <RequestSubmitForm
          nickname={nickname}
          nicknameError={nicknameError}
          onNicknameChange={handleNicknameChange}
          showSuccessModal={showSuccessModal}
          requestStatus={requestStatus}
          statusMessage={statusMessage}
          onMakeAnotherRequest={handleMakeAnotherRequest}
          onImDone={handleImDone}
        >
          <TrackSearch
            query={searchQuery}
            onQueryChange={handleSearchQueryChange}
            results={searchResults}
            isSearching={isSearching}
            searchFeedback={searchFeedback}
            nickname={nickname}
            isNicknameValid={isNicknameValid}
            isSubmitting={isSubmitting}
            onSelectTrack={(track) => submitRequest(track)}
            onDismissKeyboard={dismissKeyboard}
          />
        </RequestSubmitForm>
      </div>
      
      {/* Notification Toasts */}
      {/* Push Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => dismissNotification(notification.id)}
            className="bg-[color:var(--mood-surface)] rounded-lg shadow-lg border border-[color:var(--mood-border)] max-w-sm w-full p-4 cursor-pointer hover:shadow-xl transition-all duration-200 animate-slide-down"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {notification.type === 'play_next' ? (
                  <div className="w-8 h-8 bg-[color:var(--mood-accent)]/15 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 mood-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-[color:var(--mood-accent)]/15 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 mood-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[color:var(--mood-text)] text-sm mb-1">
                  {notification.type === 'play_next' ? 'Playing Next!' : 'Request Approved!'}
                </div>
                <div className="text-sm text-[color:var(--mood-text)] font-medium truncate">
                  {notification.trackName}
                </div>
                <div className="text-xs text-[color:var(--mood-muted)] truncate">
                  by {notification.artistName}
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(notification.id);
                }}
                className="flex-shrink-0 text-[color:var(--mood-muted)] hover:text-[color:var(--mood-muted)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Debug footer */}
      <div className="fixed bottom-2 left-2 text-[color:var(--mood-muted)] text-xs bg-black/20 px-2 py-1 rounded">
        @{username}
      </div>
    </MoodShell>
  );
}
