import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  isAuthenticated: boolean;
  
  // Data
  adminData: AdminData | null;
  spotifyState: SpotifyState | null;
  
  // Actions
  sendAction: (type: string, payload: any) => void;
  authenticate: (token: string) => void;
  
  // Real-time progress
  currentProgress: number;
}

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [spotifyState, setSpotifyState] = useState<SpotifyState | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  
  // Progress simulation
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressUpdateRef = useRef<number>(0);

  const startProgressSimulation = useCallback((state: SpotifyState) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (!state.is_playing || !state.current_track) return;

    const startTime = Date.now();
    const initialProgress = state.progress_ms;
    lastProgressUpdateRef.current = state.timestamp;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = initialProgress + elapsed;
      const maxProgress = state.current_track.duration_ms;

      if (newProgress >= maxProgress) {
        setCurrentProgress(maxProgress);
        clearInterval(progressIntervalRef.current!);
      } else {
        setCurrentProgress(newProgress);
      }
    }, 100); // Update every 100ms for smooth progress
  }, []);

  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const sendAction = useCallback((type: string, payload: any) => {
    if (socketRef.current && isAuthenticated) {
      socketRef.current.emit('admin:action', { type, payload });
    }
  }, [isAuthenticated]);

  const authenticate = useCallback((token: string) => {
    if (socketRef.current) {
      socketRef.current.emit('admin:authenticate', token);
    }
  }, []);

  useEffect(() => {
    // Initialize WebSocket connection
    const socket = io({
      path: '/api/websocket',
      addTrailingSlash: false,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      setIsConnected(true);
      
      // Auto-authenticate if token exists
      const token = localStorage.getItem('admin_token');
      if (token) {
        socket.emit('admin:authenticate', token);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
      setIsConnected(false);
      setIsAuthenticated(false);
      stopProgressSimulation();
    });

    // Authentication events
    socket.on('admin:auth-success', () => {
      console.log('✅ WebSocket authentication successful');
      setIsAuthenticated(true);
    });

    socket.on('admin:auth-failed', () => {
      console.log('❌ WebSocket authentication failed');
      setIsAuthenticated(false);
      localStorage.removeItem('admin_token');
    });

    // Data events
    socket.on('admin:full-update', (data: AdminData) => {
      console.log('📦 Received full admin data update');
      setAdminData(data);
      if (data.spotify_state) {
        setSpotifyState(data.spotify_state);
        setCurrentProgress(data.spotify_state.progress_ms);
        startProgressSimulation(data.spotify_state);
      }
    });

    socket.on('admin:update', (data: AdminData) => {
      console.log('🔄 Received admin data update');
      setAdminData(data);
    });

    socket.on('spotify:update', (state: SpotifyState) => {
      console.log('🎵 Received Spotify state update');
      setSpotifyState(state);
      setCurrentProgress(state.progress_ms);
      
      // Update admin data with new Spotify state
      setAdminData(prev => prev ? { ...prev, spotify_state: state } : null);
      
      // Restart progress simulation
      if (state.is_playing) {
        startProgressSimulation(state);
      } else {
        stopProgressSimulation();
      }
    });

    socket.on('admin:action-error', (error: any) => {
      console.error('❌ Admin action error:', error);
      // You could show a toast notification here
    });

    // Cleanup on unmount
    return () => {
      stopProgressSimulation();
      socket.disconnect();
    };
  }, [startProgressSimulation, stopProgressSimulation]);

  return {
    isConnected,
    isAuthenticated,
    adminData,
    spotifyState,
    sendAction,
    authenticate,
    currentProgress,
  };
}

// Hook for real-time progress calculation
export function useSpotifyProgress(spotifyState: SpotifyState | null): number {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!spotifyState?.is_playing || !spotifyState.current_track) {
      setProgress(spotifyState?.progress_ms || 0);
      return;
    }

    const startTime = Date.now();
    const initialProgress = spotifyState.progress_ms;
    const serverTimestamp = spotifyState.timestamp;
    
    // Account for time since server update
    const timeSinceUpdate = startTime - serverTimestamp;
    const adjustedInitialProgress = initialProgress + timeSinceUpdate;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = adjustedInitialProgress + elapsed;
      const maxProgress = spotifyState.current_track.duration_ms;

      if (newProgress >= maxProgress) {
        setProgress(maxProgress);
        clearInterval(intervalRef.current!);
      } else {
        setProgress(Math.max(0, newProgress));
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [spotifyState]);

  return progress;
}
