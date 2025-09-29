'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { usePusher } from '@/hooks/usePusher';
import { RequestApprovedEvent, RequestRejectedEvent, RequestSubmittedEvent, RequestDeletedEvent } from '@/lib/pusher';
import { markSpotifyDisconnected } from '@/lib/spotify-status-client';

// Types (simplified from the old useAdminData)
export interface Request {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  track_uri: string;
  requester_nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface PlaybackState {
  spotify_connected: boolean;
  is_playing: boolean;
  track_name?: string;
  artist_name?: string;
  album_name?: string;
  duration_ms?: number;
  progress_ms?: number;
  image_url?: string;
  device_name?: string;
  volume_percent?: number;
  queue?: any[];
}

export interface EventSettings {
  event_title: string;
  dj_name: string;
  venue_info: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  show_qr_code: boolean;
  display_refresh_interval: number;
}

export interface Stats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  played_requests: number;
  unique_requesters: number;
  spotify_connected: boolean;
}

interface AdminDataContextType {
  requests: Request[];
  playbackState: PlaybackState | null;
  eventSettings: EventSettings | null;
  stats: Stats | null;
  loading: boolean;
  isConnected: boolean;
  connectionState: string;
  handlePlaybackControl: (action: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshPlaybackState: () => Promise<void>;
  updateEventSettings: (settings: Partial<EventSettings>) => Promise<void>;
  handleSpotifyDisconnect: () => Promise<void>;
  handleApprove: (id: string, playNext?: boolean) => Promise<void>;
  handleReject: (id: string, reason?: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handlePlayAgain: (id: string, playNext?: boolean) => Promise<void>;
  handleQueueReorder: (fromIndex: number, toIndex: number) => Promise<void>;
}

// Create the context
const AdminDataContext = createContext<AdminDataContextType | null>(null);

// Provider component
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to handle token expiration
  const handleTokenExpiration = useCallback(async (reason: string = 'expired') => {
    console.log('Token expired, clearing token and notifying all devices');
    localStorage.removeItem('admin_token');
    
    // Trigger Pusher event to notify all devices
    try {
      await fetch('/api/admin/token-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          message: 'Admin token has expired. Please log in again.'
        })
      });
    } catch (pusherError) {
      console.error('Failed to trigger token expiration event:', pusherError);
    }
  }, []);

  // 🚀 PUSHER: Real-time updates
  const { isConnected, connectionState } = usePusher({
    onRequestApproved: (data: RequestApprovedEvent) => {
      console.log('🎉 Admin: Request approved via Pusher!', data);
      // Refresh requests and stats to show the update
      refreshRequests();
      refreshStats();
    },
    onRequestRejected: (data: RequestRejectedEvent) => {
      console.log('❌ Admin: Request rejected via Pusher!', data);
      // Refresh requests and stats to show the update
      refreshRequests();
      refreshStats();
    },
    onRequestDeleted: (data: RequestDeletedEvent) => {
      console.log('🗑️ Admin: Request deleted via Pusher!', data);
      // Refresh requests and stats to show the update
      refreshRequests();
      refreshStats();
    },
    onRequestSubmitted: (data: RequestSubmittedEvent) => {
      console.log('📝 Admin: New request submitted via Pusher!', data);
      // Refresh requests and stats to show the new pending request
      refreshRequests();
      refreshStats();
    },
    onPlaybackUpdate: (data: any) => {
      console.log('🎵 Admin: Playback update via Pusher!', data);
      // Update playback state with the new data from Spotify watcher
      if (data.current_track || data.queue || data.is_playing !== undefined) {
        const newPlaybackState = {
          spotify_connected: true, // If we're getting playback updates, we're connected
          is_playing: data.is_playing || false,
          track_name: data.current_track?.name,
          artist_name: Array.isArray(data.current_track?.artists) 
            ? data.current_track.artists.join(', ')
            : data.current_track?.artists || '',
          album_name: data.current_track?.album?.name || data.current_track?.album || '',
          duration_ms: data.current_track?.duration_ms,
          progress_ms: data.progress_ms || 0,
          image_url: data.current_track?.album?.images?.[1]?.url || data.current_track?.album?.images?.[0]?.url,
          device_name: data.device?.name,
          volume_percent: data.device?.volume_percent,
          queue: data.queue || []
        };
        
        setPlaybackState(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newPlaybackState)) {
            console.log('🎵 Admin: Updating playback state from Pusher:', {
              track_name: newPlaybackState.track_name,
              is_playing: newPlaybackState.is_playing,
              queue_length: newPlaybackState.queue.length
            });
            return newPlaybackState;
          }
          return prev;
        });
      }
    },
    onStatsUpdate: (data: any) => {
      console.log('📊 Admin: Stats updated via Pusher!', data);
      setStats(prev => {
        // Only update if stats actually changed
        if (JSON.stringify(prev) !== JSON.stringify(data)) {
          console.log('📊 Admin: Stats actually changed, updating');
          return data;
        }
        console.log('📊 Admin: Stats unchanged, skipping update');
        return prev;
      });
    },
    onTokenExpired: (data: any) => {
      console.log('🔒 Admin: Token expired via Pusher!', data);
      // Clear the token and trigger logout on all devices
      localStorage.removeItem('admin_token');
      // The AdminLayout will handle the UI logout
    }
  });

  // Fetch requests
  const refreshRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const requestsArray = data.requests || data; // Handle both formats
        setRequests(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(requestsArray)) {
            return requestsArray;
          }
          return prev;
        });
      } else if (response.status === 401) {
        // Token expired
        console.log('Token expired during requests fetch');
        await handleTokenExpiration('expired');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  }, [handleTokenExpiration]);

  // Fetch playback state
  const refreshPlaybackState = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/queue/details', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 AdminDataContext: Raw queue details response:', {
          spotify_connected: data.spotify_connected,
          has_current_track: !!data.current_track,
          queue_length: data.queue?.length || 0,
          debug: data.debug
        });
        
        const newPlaybackState = {
          spotify_connected: data.spotify_connected,
          is_playing: data.is_playing,
          track_name: data.current_track?.name,
          artist_name: data.current_track?.artists?.join(', '),
          album_name: data.current_track?.album,
          duration_ms: data.current_track?.duration_ms,
          progress_ms: data.current_track?.progress_ms,
          image_url: data.current_track?.image_url,
          device_name: data.device?.name,
          volume_percent: data.device?.volume_percent,
          queue: data.queue || []
        };
        
        setPlaybackState(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newPlaybackState)) {
            console.log('🎵 AdminDataContext: Updating playback state:', {
              spotify_connected: newPlaybackState.spotify_connected,
              track_name: newPlaybackState.track_name,
              is_playing: newPlaybackState.is_playing
            });
            return newPlaybackState;
          }
          return prev;
        });
      } else if (response.status === 401) {
        // Token expired
        console.log('Token expired during playback state fetch');
        await handleTokenExpiration('expired');
      }
    } catch (error) {
      console.error('Failed to fetch playback state:', error);
    }
  }, [handleTokenExpiration]);

  // Fetch event settings
  const refreshEventSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/event-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEventSettings(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      } else if (response.status === 401) {
        // Token expired
        console.log('Token expired during event settings fetch');
        await handleTokenExpiration('expired');
      }
    } catch (error) {
      console.error('Failed to fetch event settings:', error);
    }
  }, [handleTokenExpiration]);

  // Fetch stats
  const refreshStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      } else if (response.status === 401) {
        // Token expired
        console.log('Token expired during stats fetch');
        await handleTokenExpiration('expired');
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [handleTokenExpiration]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      refreshRequests(),
      refreshPlaybackState(),
      refreshEventSettings(),
      refreshStats()
    ]);
    setLoading(false);
  }, [refreshRequests, refreshPlaybackState, refreshEventSettings, refreshStats]);

  // Handle playback controls
  const handlePlaybackControl = useCallback(async (action: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch(`/api/admin/playback/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        // Refresh playback state after control action
        setTimeout(() => refreshPlaybackState(), 1000);
      }
    } catch (error) {
      console.error(`Failed to ${action} playback:`, error);
    }
  }, [refreshPlaybackState]);

  // Update event settings
  const updateEventSettings = useCallback(async (settings: Partial<EventSettings>) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/event-settings', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        // Refresh event settings after update
        await refreshEventSettings();
      }
    } catch (error) {
      console.error('Failed to update event settings:', error);
    }
  }, [refreshEventSettings]);

  // Handle Spotify disconnect
  const handleSpotifyDisconnect = useCallback(async () => {
    try {
      // Mark Spotify as disconnected in centralized status
      markSpotifyDisconnected();
      
      // Immediately update state to reflect disconnected status
      setPlaybackState(prev => prev ? { ...prev, spotify_connected: false } : null);
      setStats(prev => prev ? { ...prev, spotify_connected: false } : prev);
      
      // Refresh all data to ensure consistency
      await refreshData();
    } catch (error) {
      console.error('Failed to refresh data after disconnect:', error);
    }
  }, [refreshData]);

  // Initial data load and start Spotify watcher
  useEffect(() => {
    const initializeAdmin = async () => {
      await refreshData();
      
      // Start Spotify watcher for real-time Pusher events
      try {
        const token = localStorage.getItem('admin_token');
        if (token) {
          await fetch('/api/admin/spotify-watcher', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'start', interval: 2000 })
          });
          console.log('🎵 Spotify watcher started');
        }
      } catch (error) {
        console.error('Failed to start Spotify watcher:', error);
      }
    };

    initializeAdmin();
  }, [refreshData]);

  // No more periodic refresh - Pusher handles real-time updates!

  // Request management methods
  const handleApprove = useCallback(async (id: string, playNext?: boolean) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('❌ No admin token found for approve request');
        return;
      }

      console.log(`🎵 Approving request ${id} (play_next: ${playNext})`);
      
      const response = await fetch(`/api/admin/approve/${id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          add_to_queue: true,
          add_to_playlist: true,
          play_next: playNext || false
        })
      });
      
      if (response.ok) {
        console.log(`✅ Request ${id} approved successfully (play_next: ${playNext})`);
        await refreshRequests();
        await refreshStats();
      } else {
        const error = await response.text();
        console.error(`❌ Failed to approve request ${id}:`, response.status, error);
      }
    } catch (error) {
      console.error(`❌ Error approving request ${id}:`, error);
    }
  }, [refreshRequests, refreshStats]);

  const handleReject = useCallback(async (id: string, reason?: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('❌ No admin token found for reject request');
        return;
      }

      console.log(`🚫 Rejecting request ${id}`);

      const response = await fetch(`/api/admin/reject/${id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason || 'Rejected by admin'
        })
      });
      
      if (response.ok) {
        console.log(`✅ Request ${id} rejected successfully`);
        await refreshRequests();
        await refreshStats();
      } else {
        const error = await response.text();
        console.error(`❌ Failed to reject request ${id}:`, response.status, error);
      }
    } catch (error) {
      console.error(`❌ Error rejecting request ${id}:`, error);
    }
  }, [refreshRequests, refreshStats]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('❌ No admin token found for delete request');
        return;
      }

      console.log(`🗑️ Deleting request ${id}`);

      const response = await fetch(`/api/admin/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        console.log(`✅ Request ${id} deleted successfully`);
        await refreshRequests();
        await refreshStats();
      } else {
        const error = await response.text();
        console.error(`❌ Failed to delete request ${id}:`, response.status, error);
      }
    } catch (error) {
      console.error(`❌ Error deleting request ${id}:`, error);
    }
  }, [refreshRequests, refreshStats]);

  const handlePlayAgain = useCallback(async (id: string, playNext?: boolean) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('❌ No admin token found for play again request');
        return;
      }

      console.log(`🔄 Playing request ${id} again (play_next: ${playNext})`);

      const response = await fetch(`/api/admin/play-again/${id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          play_next: playNext || false
        })
      });
      
      if (response.ok) {
        console.log(`✅ Request ${id} played again successfully (play_next: ${playNext})`);
        await refreshRequests();
        await refreshStats();
      } else {
        const error = await response.text();
        console.error(`❌ Failed to play again request ${id}:`, response.status, error);
      }
    } catch (error) {
      console.error(`❌ Error playing again request ${id}:`, error);
    }
  }, [refreshRequests, refreshStats]);


  const handleQueueReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      // Optimistically update the local queue for immediate UI feedback
      setPlaybackState(prev => {
        if (!prev?.queue) return prev;
        
        const newQueue = [...prev.queue];
        const [movedItem] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, movedItem);
        
        return {
          ...prev,
          queue: newQueue
        };
      });

      const response = await fetch('/api/admin/queue/reorder', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fromIndex, toIndex })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Queue reorder requested:', result.message);
        if (result.limitation) {
          console.warn('⚠️ Limitation:', result.limitation);
        }
        if (result.spotify_unavailable) {
          console.warn('⚠️ Spotify API unavailable, UI-only reorder applied');
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to reorder queue:', response.status, errorText);
        // Revert the optimistic update on failure
        await refreshPlaybackState();
      }
    } catch (error) {
      console.error('Error reordering queue:', error);
      // Revert the optimistic update on error
      await refreshPlaybackState();
    }
  }, [refreshPlaybackState]);

  const value: AdminDataContextType = {
    requests,
    playbackState,
    eventSettings,
    stats,
    loading,
    isConnected,
    connectionState,
    handlePlaybackControl,
    refreshData,
    refreshPlaybackState,
    updateEventSettings,
    handleSpotifyDisconnect,
    handleApprove,
    handleReject,
    handleDelete,
    handlePlayAgain,
    handleQueueReorder
  };
  
  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}

// Hook to use the admin data context
export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
}
