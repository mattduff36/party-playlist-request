'use client';

import { useState, useEffect, useCallback } from 'react';

interface PlaybackState {
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

interface EventSettings {
  now_playing_polling_interval?: number;
}

export const useNowPlayingProgress = (
  playbackState: PlaybackState | null,
  eventSettings: EventSettings | null
) => {
  const [progress, setProgress] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Real-time progress simulation
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
    }, 100); // Update every 100ms for smooth progress

    return () => clearInterval(interval);
  }, [playbackState?.is_playing, playbackState?.timestamp, playbackState?.progress_ms, playbackState?.duration_ms]);

  // Periodic refresh of playback state for more accurate progress
  const refreshPlaybackState = useCallback(async () => {
    const now = Date.now();
    const pollingInterval = (eventSettings?.now_playing_polling_interval || 5) * 1000;
    
    // Don't fetch too frequently
    if (now - lastFetchTime < pollingInterval) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/queue/details', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.spotify_connected && data.progress_ms !== undefined) {
          // Update progress with fresh data from server
          setProgress(data.progress_ms);
          setLastFetchTime(now);
        }
      }
    } catch (error) {
      console.error('Error refreshing playback state:', error);
    }
  }, [eventSettings?.now_playing_polling_interval, lastFetchTime]);

  // Set up periodic refresh
  useEffect(() => {
    if (!playbackState?.spotify_connected) return;

    const pollingInterval = (eventSettings?.now_playing_polling_interval || 5) * 1000;
    console.log(`🎵 Now Playing progress refresh interval: ${pollingInterval/1000}s`);

    const interval = setInterval(refreshPlaybackState, pollingInterval);
    return () => clearInterval(interval);
  }, [refreshPlaybackState, playbackState?.spotify_connected, eventSettings?.now_playing_polling_interval]);

  return progress;
};
