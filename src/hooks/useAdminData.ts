'use client';

import { useState, useEffect, useCallback } from 'react';
// Create a simple interaction lock hook inline since we removed the other file
const useInteractionLock = () => {
  const [isInteracting, setIsInteracting] = useState(false);
  
  const lockInteraction = useCallback((duration: number) => {
    setIsInteracting(true);
    setTimeout(() => setIsInteracting(false), duration);
  }, []);
  
  return { isInteracting, lockInteraction };
};

// Create a simple progress hook inline
const useRealtimeProgress = (playbackState: PlaybackState | null) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (!playbackState?.is_playing || !playbackState.timestamp) {
      setProgress(playbackState?.progress_ms || 0);
      return;
    }
    
    const startTime = Date.now();
    const initialProgress = playbackState.progress_ms;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = initialProgress + elapsed;
      const maxProgress = playbackState.duration_ms;
      
      if (newProgress >= maxProgress) {
        setProgress(maxProgress);
        clearInterval(interval);
      } else {
        setProgress(Math.max(0, newProgress));
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [playbackState?.is_playing, playbackState?.timestamp, playbackState?.progress_ms, playbackState?.duration_ms]);
  
  return progress;
};
import { useRealtimeUpdates } from './useRealtimeUpdates';

export interface Request {
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

export interface PlaybackState {
  is_playing: boolean;
  progress_ms: number;
  duration_ms: number;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_image_url?: string;
  device_name?: string;
  volume_percent?: number;
  spotify_connected: boolean;
  queue?: any[];
  timestamp: number;
}

export interface EventSettings {
  event_title: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  request_limit: number;
  auto_approve: boolean;
  // Polling intervals (in seconds)
  admin_polling_interval: number;
  display_polling_interval: number;
  now_playing_polling_interval: number;
  sse_update_interval: number;
}

export interface Stats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  played_requests: number;
  unique_requesters: number;
}

export const useAdminData = (options: { disablePolling?: boolean } = {}) => {
  const { disablePolling = false } = options;
  const [requests, setRequests] = useState<Request[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [spotifyFailureCount, setSpotifyFailureCount] = useState(0);
  const [lastSpotifyFailure, setLastSpotifyFailure] = useState(0);

  const { isInteracting, lockInteraction } = useInteractionLock();
  const realtimeUpdates = useRealtimeUpdates();
  const realtimeProgress = useRealtimeProgress(playbackState);

  // Check if user is authenticated
  const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('admin_token');

  // Sync real-time data with local state
  useEffect(() => {
    if (realtimeUpdates.isConnected && realtimeUpdates.adminData) {
      console.log(`🔄 Syncing ${realtimeUpdates.connectionType} data to local state`);
      
      if (realtimeUpdates.adminData.requests) {
        setRequests(realtimeUpdates.adminData.requests);
      }
      
      if (realtimeUpdates.adminData.spotify_state) {
        const spotifyState = realtimeUpdates.adminData.spotify_state;
        setPlaybackState({
          is_playing: spotifyState.is_playing,
          progress_ms: realtimeUpdates.currentProgress || spotifyState.progress_ms,
          duration_ms: spotifyState.current_track?.duration_ms || 0,
          track_name: spotifyState.current_track?.name || '',
          artist_name: spotifyState.current_track?.artists?.[0]?.name || '',
          album_name: spotifyState.current_track?.album?.name || '',
          album_image_url: spotifyState.current_track?.album?.images?.[0]?.url,
          device_name: spotifyState.playback_state?.device?.name,
          volume_percent: spotifyState.playback_state?.device?.volume_percent,
          spotify_connected: true,
          queue: spotifyState.queue || [],
          timestamp: spotifyState.timestamp
        });
      }
      
      if (realtimeUpdates.adminData.event_settings) {
        setEventSettings(realtimeUpdates.adminData.event_settings);
      }
      
      if (realtimeUpdates.adminData.stats) {
        setStats(realtimeUpdates.adminData.stats);
      }
    }
  }, [realtimeUpdates.isConnected, realtimeUpdates.adminData, realtimeUpdates.currentProgress, realtimeUpdates.connectionType]);

  // Fetch all data with authentication
  const fetchData = useCallback(async (showBackgroundIndicator = false) => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      if (showBackgroundIndicator) {
        setIsBackgroundRefreshing(true);
      }
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Circuit breaker: Skip Spotify queue requests if they've been failing
      const now = Date.now();
      const shouldSkipSpotify = spotifyFailureCount >= 3 && (now - lastSpotifyFailure) < 60000;
      
      let queueRes;
      if (shouldSkipSpotify) {
        console.log('🚫 Skipping Spotify queue request due to circuit breaker');
        queueRes = { ok: false, status: 503, json: async () => ({ spotify_connected: false }) };
      }
      
      const requests = [
        fetch('/api/admin/requests?limit=100', { headers }),
        shouldSkipSpotify ? Promise.resolve(queueRes) : fetch('/api/admin/queue/details', { headers }),
        fetch('/api/admin/event-settings', { headers }),
        fetch('/api/admin/stats', { headers })
      ];
      
      const [requestsRes, queueResponse, settingsRes, statsRes] = await Promise.all(requests);
      queueRes = queueResponse;

      // Check for authentication errors (but not Spotify-related 401s)
      if (requestsRes.status === 401 || settingsRes.status === 401 || statsRes.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.reload();
        return;
      }

      // Handle requests
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.requests || []);
      }

      // Handle Spotify queue with circuit breaker
      if (queueRes && queueRes.ok) {
        const queueData = await queueRes.json();
        if (queueData.spotify_connected) {
          setPlaybackState({
            ...queueData,
            timestamp: Date.now() // Add timestamp for real-time progress
          });
          // Reset failure count on success
          if (spotifyFailureCount > 0) {
            setSpotifyFailureCount(0);
            setLastSpotifyFailure(0);
          }
        } else {
          setPlaybackState(prev => prev ? { ...prev, spotify_connected: false } : null);
        }
      } else if (queueRes && !shouldSkipSpotify) {
        // Only increment failure count for actual failures, not circuit breaker skips
        setSpotifyFailureCount(prev => prev + 1);
        setLastSpotifyFailure(now);
        setPlaybackState(prev => prev ? { ...prev, spotify_connected: false } : null);
      }

      // Handle settings
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setEventSettings(settingsData);
      }

      // Handle stats
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
      setIsBackgroundRefreshing(false);
    }
  }, [isAuthenticated, spotifyFailureCount, lastSpotifyFailure]);

  // Auto-refresh data when authenticated
  // Initial data fetch - always run this regardless of real-time connection
  useEffect(() => {
    if (!isAuthenticated) return;
    
    console.log('🚀 Running initial data fetch');
    fetchData(); // Initial fetch only
  }, [isAuthenticated, fetchData]);

  // Separate useEffect for polling to avoid recreating intervals
  // Only use polling when real-time connection is not available
  useEffect(() => {
    if (!isAuthenticated || disablePolling) return;
    
    // Skip polling if real-time connection is available
    if (realtimeUpdates.isConnected) {
      console.log(`🔌 ${realtimeUpdates.connectionType} connected - skipping polling`);
      return;
    }
    
    console.log('🔄 Setting up polling interval (real-time not available)');
    
    // Auto-refresh every 30 seconds
    let refreshCount = 0;
    const interval = setInterval(() => {
      console.log('⏰ Polling tick - hidden:', document.hidden, 'interacting:', isInteracting);
      
      // Silent refresh - don't show loading states
      // Only refresh if the page is visible and user is not interacting
      if (!document.hidden && !isInteracting) {
        console.log('🔄 Running scheduled refresh');
        fetchData(false); // false = no background indicator for automatic refreshes
        
        // Run cleanup every 4th refresh (every 2 minutes)
        refreshCount++;
        if (refreshCount % 4 === 0) {
          // Could add cleanup logic here if needed
        }
      } else {
        console.log('⏸️ Skipping refresh - page hidden or user interacting');
      }
    }, 30000); // 30 seconds
    
    return () => {
      console.log('🧹 Cleaning up polling interval');
      clearInterval(interval);
    };
  }, [isAuthenticated, isInteracting, fetchData, disablePolling, realtimeUpdates.isConnected, realtimeUpdates.connectionType]);

  // Action handlers - all use HTTP since SSE doesn't support sending actions
  const handleApprove = async (id: string, playNext = false) => {
    lockInteraction(3000);
    
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`/api/admin/approve/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ play_next: playNext }),
      });
      
      if (response.ok) {
        // Don't fetch data immediately if SSE is connected - it will update automatically
        if (!realtimeUpdates.isConnected) {
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleReject = async (id: string) => {
    lockInteraction(3000);
    
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`/api/admin/reject/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Don't fetch data immediately if SSE is connected - it will update automatically
        if (!realtimeUpdates.isConnected) {
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleDelete = async (id: string) => {
    lockInteraction(3000);
    
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`/api/admin/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Don't fetch data immediately if SSE is connected - it will update automatically
        if (!realtimeUpdates.isConnected) {
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  };

  const handlePlayAgain = async (id: string, playNext: boolean) => {
    lockInteraction(3000);
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`/api/admin/play-again/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ play_next: playNext }),
      });
      
      if (response.ok) {
        // Don't fetch data immediately if SSE is connected - it will update automatically
        if (!realtimeUpdates.isConnected) {
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error playing request again:', error);
    }
  };

  const handlePlaybackControl = async (action: 'play' | 'pause' | 'skip') => {
    lockInteraction(3000);
    
    const token = localStorage.getItem('admin_token');
    try {
      const endpoint = action === 'skip' ? 'skip' : action === 'play' ? 'resume' : 'pause';
      const response = await fetch(`/api/admin/playback/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // Don't fetch data immediately if SSE is connected - it will update automatically
        if (!realtimeUpdates.isConnected) {
          fetchData();
        }
      }
    } catch (error) {
      console.error(`Error ${action}ing playback:`, error);
    }
  };

  const updateEventSettings = async (settings: Partial<EventSettings>) => {
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch('/api/admin/event-settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        // Don't fetch data immediately if SSE is connected - it will update automatically
        if (!realtimeUpdates.isConnected) {
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  return {
    // Data
    requests,
    playbackState,
    eventSettings,
    stats,
    realtimeProgress,
    
    // State
    loading,
    isBackgroundRefreshing,
    isInteracting,
    
    // Real-time connection state
    isWebSocketConnected: realtimeUpdates.isConnected, // Keep name for compatibility
    isWebSocketAuthenticated: realtimeUpdates.connectionType !== 'polling', // Keep name for compatibility
    connectionType: realtimeUpdates.connectionType,
    
    // Actions
    fetchData,
    handleApprove,
    handleReject,
    handleDelete,
    handlePlayAgain,
    handlePlaybackControl,
    updateEventSettings,
    lockInteraction,
  };
};
