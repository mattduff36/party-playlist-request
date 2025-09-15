'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SpotifyState {
  current_track: any;
  queue: any[];
  playback_state: any;
  is_playing: boolean;
  progress_ms: number;
  timestamp: number;
}

interface AdminData {
  requests: any[];
  spotify_state: SpotifyState | null;
  event_settings: any;
  stats: {
    total_requests: number;
    pending_requests: number;
    approved_requests: number;
    rejected_requests: number;
    played_requests: number;
    unique_requesters: number;
    spotify_connected: boolean;
  };
}

interface UseRealtimeUpdatesReturn {
  isConnected: boolean;
  connectionType: 'sse' | 'polling';
  adminData: AdminData | null;
  spotifyState: SpotifyState | null;
  currentProgress: number;
}

export function useRealtimeUpdates(): UseRealtimeUpdatesReturn {
  const [sseData, setSseData] = useState<AdminData | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Try SSE first, fallback to polling if it fails
  const [useSSE, setUseSSE] = useState(true);

  // SSE connection
  useEffect(() => {
    if (!useSSE || typeof window === 'undefined') return;

    const token = localStorage.getItem('admin_token');
    if (!token) return;

    console.log('🌐 Connecting to SSE for real-time updates');
    
    const eventSource = new EventSource(`/api/admin/events?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          console.log('SSE server acknowledged connection');
        } else if (data.type === 'error') {
          console.error('SSE server error:', data.message);
        } else {
          console.log('📡 Received SSE data update');
          setSseData(data);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error, falling back to polling:', error);
      setSseConnected(false);
      setUseSSE(false); // Fallback to polling
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
      setSseConnected(false);
      console.log('❌ SSE connection closed');
    };
  }, [useSSE]);

  // Progress simulation
  const startProgressSimulation = useCallback((state: SpotifyState) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (!state.is_playing || !state.current_track) return;

    const startTime = Date.now();
    const initialProgress = state.progress_ms;
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = initialProgress + elapsed;
      const maxProgress = state.current_track.duration_ms;

      if (newProgress >= maxProgress) {
        setCurrentProgress(maxProgress);
        clearInterval(progressIntervalRef.current!);
      } else {
        setCurrentProgress(Math.max(0, newProgress));
      }
    }, 100); // Update every 100ms for smooth progress
  }, []);

  // Update progress when Spotify state changes
  useEffect(() => {
    const spotifyState = sseData?.spotify_state;
    
    if (spotifyState) {
      setCurrentProgress(spotifyState.progress_ms);
      if (spotifyState.is_playing) {
        startProgressSimulation(spotifyState);
      } else {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
    }
  }, [sseData?.spotify_state, startProgressSimulation]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return {
    isConnected: sseConnected,
    connectionType: sseConnected ? 'sse' : 'polling',
    adminData: sseData,
    spotifyState: sseData?.spotify_state || null,
    currentProgress,
  };
}