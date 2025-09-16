'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { usePusher } from '@/hooks/usePusher';
import { RequestApprovedEvent, RequestRejectedEvent } from '@/lib/pusher';

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

  // 🚀 PUSHER: Real-time updates
  const { isConnected, connectionState } = usePusher({
    onRequestApproved: (data: RequestApprovedEvent) => {
      console.log('🎉 Admin: Request approved via Pusher!', data);
      // Refresh requests to show the update
      refreshRequests();
    },
    onRequestRejected: (data: RequestRejectedEvent) => {
      console.log('❌ Admin: Request rejected via Pusher!', data);
      // Refresh requests to show the update
      refreshRequests();
    },
    onStatsUpdate: (data: any) => {
      console.log('📊 Admin: Stats updated via Pusher!', data);
      setStats(data);
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
        setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  }, []);

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
        setPlaybackState({
          spotify_connected: data.spotify_connected,
          is_playing: data.is_playing,
          track_name: data.current_track?.name,
          artist_name: data.current_track?.artists?.join(', '),
          album_name: data.current_track?.album,
          duration_ms: data.current_track?.duration_ms,
          progress_ms: data.current_track?.progress_ms,
          image_url: data.current_track?.image_url
        });
      }
    } catch (error) {
      console.error('Failed to fetch playback state:', error);
    }
  }, []);

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
        setEventSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch event settings:', error);
    }
  }, []);

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
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

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

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Periodic refresh (much less aggressive than before)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPlaybackState(); // Only refresh playback state regularly
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
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
    refreshData
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
