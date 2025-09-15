import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

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
  stats: any;
}

interface UseRealtimeUpdatesReturn {
  // Connection state
  isConnected: boolean;
  connectionType: 'websocket' | 'sse' | 'polling';
  
  // Data
  adminData: AdminData | null;
  spotifyState: SpotifyState | null;
  
  // Actions (only available with WebSocket)
  sendAction?: (type: string, payload: any) => void;
  
  // Real-time progress
  currentProgress: number;
}

export function useRealtimeUpdates(): UseRealtimeUpdatesReturn {
  const webSocket = useWebSocket();
  const [sseData, setSseData] = useState<AdminData | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we should use WebSocket or SSE
  const useWebSocket = process.env.NODE_ENV === 'development';
  const useSSE = process.env.NODE_ENV === 'production';

  // SSE connection for production
  useEffect(() => {
    if (!useSSE) return;

    const token = localStorage.getItem('admin_token');
    if (!token) return;

    console.log('🌐 Connecting to SSE for real-time updates');

    const eventSource = new EventSource('/api/admin/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('📡 SSE connected');
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'admin:update') {
          console.log('📦 SSE data update received');
          setSseData(data.data);
        } else if (data.type === 'connected') {
          console.log('✅ SSE connection confirmed');
        }
      } catch (error) {
        console.error('SSE message parse error:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
      setSseConnected(false);
    };
  }, [useSSE]);

  // Progress simulation for SSE
  const startProgressSimulation = useCallback((state: SpotifyState) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (!state.is_playing || !state.current_track) return;

    const startTime = Date.now();
    const initialProgress = state.progress_ms;
    const serverTimestamp = state.timestamp;
    
    // Account for time since server update
    const timeSinceUpdate = startTime - serverTimestamp;
    const adjustedInitialProgress = initialProgress + timeSinceUpdate;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = adjustedInitialProgress + elapsed;
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
    const spotifyState = useWebSocket ? webSocket.spotifyState : sseData?.spotify_state;
    
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
  }, [useWebSocket, webSocket.spotifyState, sseData?.spotify_state, startProgressSimulation]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Determine connection state and data source
  const isConnected = useWebSocket ? webSocket.isConnected && webSocket.isAuthenticated : sseConnected;
  const connectionType = useWebSocket 
    ? (webSocket.isConnected && webSocket.isAuthenticated ? 'websocket' : 'polling')
    : (sseConnected ? 'sse' : 'polling');
  
  const adminData = useWebSocket ? webSocket.adminData : sseData;
  const spotifyState = useWebSocket ? webSocket.spotifyState : sseData?.spotify_state || null;

  return {
    isConnected,
    connectionType,
    adminData,
    spotifyState,
    sendAction: useWebSocket ? webSocket.sendAction : undefined,
    currentProgress,
  };
}
