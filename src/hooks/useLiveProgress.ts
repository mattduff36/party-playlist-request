'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PlaybackState {
  progress_ms: number;
  duration_ms: number;
  is_playing: boolean;
  timestamp?: number;
  spotify_connected?: boolean;
}

interface UseLiveProgressReturn {
  currentProgress: number;
  currentTime: string;
  totalTime: string;
  progressPercentage: number;
  isAnimating: boolean;
}

/**
 * Custom hook that provides live progress animation and time counter
 * Smoothly animates progress between real updates to make UI feel responsive
 */
export const useLiveProgress = (
  playbackState: PlaybackState | null,
  updateInterval: number = 1000 // How often to update the animation (1 second)
): UseLiveProgressReturn => {
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);

  const formatDuration = useCallback((ms: number): string => {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Update animation frame
  const updateProgress = useCallback(() => {
    if (!playbackState?.is_playing || !playbackState.spotify_connected) {
      setIsAnimating(false);
      return;
    }

    const now = Date.now();
    const elapsed = now - startTimeRef.current;
    const newProgress = Math.min(
      startProgressRef.current + elapsed,
      playbackState.duration_ms || 0
    );

    setCurrentProgress(newProgress);
    setIsAnimating(true);

    // Continue animation if still playing and within duration
    if (newProgress < (playbackState.duration_ms || 0)) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      setIsAnimating(false);
    }
  }, [playbackState?.is_playing, playbackState?.spotify_connected, playbackState?.duration_ms]);

  // Start/stop animation based on playback state changes
  useEffect(() => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (!playbackState) {
      setCurrentProgress(0);
      setIsAnimating(false);
      return;
    }

    // Set initial progress from real data
    const realProgress = playbackState.progress_ms || 0;
    setCurrentProgress(realProgress);
    
    // If playing, start smooth animation
    if (playbackState.is_playing && playbackState.spotify_connected) {
      startTimeRef.current = Date.now();
      startProgressRef.current = realProgress;
      lastUpdateRef.current = Date.now();
      
      // Start animation loop
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      setIsAnimating(false);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    playbackState?.progress_ms,
    playbackState?.is_playing,
    playbackState?.spotify_connected,
    playbackState?.timestamp,
    updateProgress
  ]);

  // Recalibrate animation when we get fresh data
  useEffect(() => {
    if (playbackState?.progress_ms !== undefined && isAnimating) {
      const now = Date.now();
      
      // Only recalibrate if we've received significantly different data
      // This prevents constant recalibration from minor timing differences
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      const expectedProgress = startProgressRef.current + timeSinceLastUpdate;
      const actualProgress = playbackState.progress_ms;
      const difference = Math.abs(expectedProgress - actualProgress);
      
      // Recalibrate if difference is more than 2 seconds
      if (difference > 2000 || timeSinceLastUpdate > 30000) { // Also recalibrate every 30 seconds
        startTimeRef.current = now;
        startProgressRef.current = actualProgress;
        lastUpdateRef.current = now;
        setCurrentProgress(actualProgress);
        
        console.log('🎵 Progress recalibrated:', {
          expected: Math.floor(expectedProgress / 1000),
          actual: Math.floor(actualProgress / 1000),
          difference: Math.floor(difference / 1000)
        });
      }
    }
  }, [playbackState?.progress_ms, isAnimating]);

  // Calculate derived values
  const progressPercentage = playbackState?.duration_ms 
    ? Math.min(100, Math.max(0, (currentProgress / playbackState.duration_ms) * 100))
    : 0;

  const currentTime = formatDuration(currentProgress);
  const totalTime = formatDuration(playbackState?.duration_ms || 0);

  return {
    currentProgress,
    currentTime,
    totalTime,
    progressPercentage,
    isAnimating
  };
};
