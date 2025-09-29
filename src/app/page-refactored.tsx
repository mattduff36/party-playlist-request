'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { usePusher } from '@/hooks/usePusher';
import { useGlobalEvent, usePageState, useEventConfig, useIsLoading, useError } from '@/lib/state/global-event';
import PartyNotStarted from '@/components/PartyNotStarted';
import PagesDisabled from '@/components/PagesDisabled';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import RequestForm from '@/components/RequestForm';

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

export default function HomePage() {
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [mounted, setMounted] = useState(false);
  
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

  // Global state hooks
  const { state, actions } = useGlobalEvent();
  const pageState = usePageState();
  const eventConfig = useEventConfig();
  const isLoading = useIsLoading();
  const error = useError();

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
      actions.refreshState();
    },
    onAdminLogin: (data: any) => {
      console.log('🔐 Admin login via Pusher:', data);
      actions.refreshState();
    },
    onAdminLogout: (data: any) => {
      console.log('🔐 Admin logout via Pusher:', data);
      actions.refreshState();
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
    }
  });

  // Initialize component and load global state
  useEffect(() => {
    console.log('🚀 HomePage: useEffect running - client-side JS is working!');
    setMounted(true);
    
    // Load global state after mounting
    console.log('🔄 HomePage: Loading global state...');
    actions.loadEvent();
  }, [actions]);

  // Search for tracks
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`${API_BASE}/search`, {
        params: { q: query }
      });
      setSearchResults(response.data.tracks || []);
    } catch (error) {
      console.error('Error searching tracks:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Submit track request
  const handleSubmitRequest = async (track: Track) => {
    if (!nickname.trim()) {
      setRequestStatus('error');
      setStatusMessage('Please enter your nickname');
      return;
    }

    setIsSubmitting(true);
    setRequestStatus('idle');

    try {
      const response = await axios.post(`${API_BASE}/request`, {
        track_uri: track.uri,
        track_name: track.name,
        artist_name: track.artists.join(', '),
        album_name: track.album,
        duration_ms: track.duration_ms,
        requester_nickname: nickname.trim(),
        user_session_id: userSessionId
      });

      const data: RequestResponse = response.data;
      
      if (data.success) {
        setRequestStatus('success');
        setStatusMessage(`Request submitted: ${track.name} by ${track.artists.join(', ')}`);
        
        // Add to user requests for tracking
        if (data.request) {
          setUserRequests(prev => new Set(prev).add(data.request!.id));
        }
        
        // Clear search
        setSearchResults([]);
      } else {
        setRequestStatus('error');
        setStatusMessage(data.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      setRequestStatus('error');
      setStatusMessage('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dismiss notifications
  const handleDismissNotifications = () => {
    setNotifications([]);
  };

  // Render based on page state
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => actions.refreshState()} />;
  }

  // State-based rendering
  if (pageState.requests === 'party-not-started') {
    return <PartyNotStarted variant="home" eventConfig={eventConfig} />;
  }

  if (pageState.requests === 'disabled') {
    return <PagesDisabled variant="requests" eventConfig={eventConfig} />;
  }

  // Main requests interface (pageState.requests === 'enabled')
  return (
    <RequestForm
      eventConfig={eventConfig}
      onSearch={handleSearch}
      onSubmitRequest={handleSubmitRequest}
      searchResults={searchResults}
      isSearching={isSearching}
      isSubmitting={isSubmitting}
      requestStatus={requestStatus}
      statusMessage={statusMessage}
      nickname={nickname}
      onNicknameChange={setNickname}
      notifications={notifications}
      onDismissNotifications={handleDismissNotifications}
    />
  );
}