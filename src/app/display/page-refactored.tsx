'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { usePusher } from '@/hooks/usePusher';
import { useGlobalEvent, usePageState, useEventConfig, useIsLoading, useError } from '@/lib/state/global-event-client';
import PartyNotStarted from '@/components/PartyNotStarted';
import PagesDisabled from '@/components/PagesDisabled';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import DisplayContent from '@/components/DisplayContent';

interface Request {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  requester_nickname: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  created_at: string;
  approved_at?: string;
}

interface NowPlaying {
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  progress_ms: number;
  is_playing: boolean;
}

const API_BASE = '/api';

export default function DisplayPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [mounted, setMounted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Global state hooks
  const { state, actions } = useGlobalEvent();
  const pageState = usePageState();
  const eventConfig = useEventConfig();
  const isLoading = useIsLoading();
  const error = useError();

  // Listen for updates via Pusher
  usePusher({
    onRequestUpdate: (data: any) => {
      console.log('🔄 Request update via Pusher:', data);
      fetchRequests();
    },
    onNowPlayingUpdate: (data: any) => {
      console.log('🎵 Now playing update via Pusher:', data);
      setNowPlaying(data);
    },
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
    }
  });

  // Initialize component and load global state
  useEffect(() => {
    console.log('🚀 DisplayPage: useEffect running - client-side JS is working!');
    setMounted(true);
    
    // Load global state after mounting
    console.log('🔄 DisplayPage: Loading global state...');
    actions.loadEvent();
  }, [actions]);

  // Fetch requests when page is enabled
  useEffect(() => {
    if (pageState.display === 'enabled') {
      fetchRequests();
      fetchNowPlaying();
    }
  }, [pageState.display]);

  // Fetch requests
  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API_BASE}/display/requests`);
      setRequests(response.data.requests || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  // Fetch now playing
  const fetchNowPlaying = async () => {
    try {
      const response = await axios.get(`${API_BASE}/display/now-playing`);
      setNowPlaying(response.data.now_playing || null);
    } catch (error) {
      console.error('Error fetching now playing:', error);
    }
  };

  // Render based on page state
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => actions.refreshState()} />;
  }

  // State-based rendering
  if (pageState.display === 'party-not-started') {
    return <PartyNotStarted variant="display" eventConfig={eventConfig} />;
  }

  if (pageState.display === 'disabled') {
    return <PagesDisabled variant="display" eventConfig={eventConfig} />;
  }

  // Main display interface (pageState.display === 'enabled')
  return (
    <DisplayContent
      eventConfig={eventConfig}
      requests={requests}
      nowPlaying={nowPlaying}
      lastUpdate={lastUpdate}
    />
  );
}