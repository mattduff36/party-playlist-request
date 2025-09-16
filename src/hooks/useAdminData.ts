'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const realtimeUpdates = useRealtimeUpdates(eventSettings?.force_polling);
  const realtimeProgress = useRealtimeProgress(playbackState);

  // Check if user is authenticated - make it reactive
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check authentication on mount and when localStorage changes
  const checkAuth = useCallback(() => {
    const hasWindow = typeof window !== 'undefined';
    const token = hasWindow ? localStorage.getItem('admin_token') : null;
    const authenticated = !!(hasWindow && token);
    
    setIsAuthenticated(prev => {
      // Only update if the value actually changed
      if (prev !== authenticated) {
        console.log('🔐 Authentication state changed:', { isAuthenticated: authenticated });
        return authenticated;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    
    // Initial check
    checkAuth();
    
    // Listen for storage changes (when token is added/removed)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_token') {
        console.log('🔐 Admin token changed in localStorage, rechecking auth...');
        checkAuth();
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      
      // Check less frequently to avoid excessive re-renders
      const interval = setInterval(checkAuth, 5000);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    }
  }, []);

  // Track the last processed data to prevent unnecessary updates
  const lastProcessedDataRef = useRef<string>('');
  
  // Sync real-time data with local state
  useEffect(() => {
    if (realtimeUpdates.isConnected && realtimeUpdates.adminData) {
      // Create a hash of the current data to check if it's actually different
      const currentDataHash = JSON.stringify({
        requests: realtimeUpdates.adminData.requests,
        spotify_state: realtimeUpdates.adminData.spotify_state,
        event_settings: realtimeUpdates.adminData.event_settings,
        stats: realtimeUpdates.adminData.stats,
        currentProgress: realtimeUpdates.currentProgress
      });
      
      // Skip processing if data hasn't actually changed
      if (lastProcessedDataRef.current === currentDataHash) {
        return;
      }
      
      lastProcessedDataRef.current = currentDataHash;
      
      console.log(`🔄 Syncing ${realtimeUpdates.connectionType} data to local state`);
      console.log('📊 SSE Data received:', {
        requests_count: realtimeUpdates.adminData.requests?.length || 0,
        has_spotify_state: !!realtimeUpdates.adminData.spotify_state,
        has_event_settings: !!realtimeUpdates.adminData.event_settings,
        has_stats: !!realtimeUpdates.adminData.stats
      });
      
      if (realtimeUpdates.adminData.requests) {
        console.log('📋 Updating requests state with', realtimeUpdates.adminData.requests.length, 'requests');
        setRequests([...realtimeUpdates.adminData.requests]);
      }
      
      if (realtimeUpdates.adminData.spotify_state) {
        const spotifyState = realtimeUpdates.adminData.spotify_state;
        console.log('🎵 Updating playback state:', {
          is_playing: spotifyState.is_playing,
          track_name: spotifyState.current_track?.name,
          artist_name: spotifyState.current_track?.artists?.[0]?.name
        });
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
          queue: [...(spotifyState.queue || [])],
          timestamp: spotifyState.timestamp
        });
      } else {
        // If SSE data doesn't have spotify_state, ensure we show disconnected status
        console.log('🎵 No Spotify state in SSE data - setting disconnected status');
        setPlaybackState(prev => {
          // Only update if the spotify_connected status actually changed
          if (prev && prev.spotify_connected !== false) {
            return { ...prev, spotify_connected: false };
          }
          return prev;
        });
      }
      
      if (realtimeUpdates.adminData.event_settings) {
        console.log('⚙️ Updating event settings');
        setEventSettings({...realtimeUpdates.adminData.event_settings});
      }
      
      if (realtimeUpdates.adminData.stats) {
        console.log('📈 Updating stats:', realtimeUpdates.adminData.stats);
        setStats({...realtimeUpdates.adminData.stats});
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
          // Transform queue data to match UI expectations
          const transformedPlaybackState = {
            // Basic playback info
            is_playing: queueData.is_playing,
            shuffle_state: queueData.shuffle_state,
            repeat_state: queueData.repeat_state,
            spotify_connected: queueData.spotify_connected,
            device: queueData.device,
            
            // Current track info (flattened from current_track object)
            track_name: queueData.current_track?.name || null,
            artist_name: queueData.current_track?.artists?.[0] || null,
            album_name: queueData.current_track?.album || null,
            album_image_url: queueData.current_track?.image_url || null,
            duration_ms: queueData.current_track?.duration_ms || 0,
            progress_ms: queueData.current_track?.progress_ms || 0,
            
            // Queue info
            queue: queueData.queue || [],
            
            // Metadata
            timestamp: Date.now()
          };
          
          console.log('🎵 Transformed playback state:', {
            track_name: transformedPlaybackState.track_name,
            artist_name: transformedPlaybackState.artist_name,
            album_name: transformedPlaybackState.album_name,
            has_album_art: !!transformedPlaybackState.album_image_url,
            spotify_connected: transformedPlaybackState.spotify_connected
          });
          
          setPlaybackState(transformedPlaybackState);
          
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

      // If no Spotify state from SSE and no queue data, ensure playback state reflects disconnected status
      if (!realtimeUpdates.adminData?.spotify_state && (!queueRes || !queueRes.ok)) {
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
  // Only use polling when real-time connection is not available OR when force polling is enabled
  useEffect(() => {
    if (!isAuthenticated || disablePolling) return;
    
    // Skip polling if real-time connection is available AND force polling is not enabled
    if (realtimeUpdates.isConnected && !eventSettings?.force_polling) {
      console.log(`🔌 ${realtimeUpdates.connectionType} connected - skipping polling`);
      return;
    }
    
    // If force polling is enabled, always use polling regardless of SSE connection
    if (eventSettings?.force_polling && realtimeUpdates.isConnected) {
      console.log(`🔄 Force polling enabled - using polling despite ${realtimeUpdates.connectionType} connection`);
    }
    
    // Get polling interval from settings (default to 15 seconds if not available)
    const pollingInterval = (eventSettings?.admin_polling_interval || 15) * 1000; // Convert to milliseconds
    const reason = eventSettings?.force_polling ? 'force polling enabled' : 'real-time not available';
    console.log(`🔄 Setting up polling interval: ${pollingInterval/1000}s (${reason})`);
    
    let refreshCount = 0;
    const interval = setInterval(() => {
      console.log('⏰ Polling tick - hidden:', document.hidden, 'interacting:', isInteracting);
      
      // Silent refresh - don't show loading states
      // Only refresh if the page is visible and user is not interacting
      if (!document.hidden && !isInteracting) {
        console.log('🔄 Running scheduled refresh');
        fetchData(false); // false = no background indicator for automatic refreshes
        
        // Run cleanup every 4th refresh
        refreshCount++;
        if (refreshCount % 4 === 0) {
          // Could add cleanup logic here if needed
        }
      } else {
        console.log('⏸️ Skipping refresh - page hidden or user interacting');
      }
    }, pollingInterval);
    
    return () => {
      console.log('🧹 Cleaning up polling interval');
      clearInterval(interval);
    };
  }, [isAuthenticated, isInteracting, fetchData, disablePolling, realtimeUpdates.isConnected, realtimeUpdates.connectionType, eventSettings?.admin_polling_interval]);

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

  const handleSpotifyDisconnect = async () => {
    // Clear playback state immediately when Spotify is disconnected
    setPlaybackState(prev => prev ? { ...prev, spotify_connected: false } : null);
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
    
    console.log('📤 Sending settings to API:', {
      settings,
      force_polling: settings.force_polling,
      auto_approve: settings.auto_approve,
      request_limit: settings.request_limit,
      stringified: JSON.stringify(settings)
    });
    
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
    handleSpotifyDisconnect,
    lockInteraction,
  };
};
