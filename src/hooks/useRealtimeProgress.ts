import { useState, useEffect, useRef } from 'react';

interface TrackProgress {
  progress_ms: number;
  duration_ms: number;
  is_playing: boolean;
  timestamp: number;
}

/**
 * Hook for real-time progress simulation
 * Takes server-side progress data and simulates real-time updates
 */
export function useRealtimeProgress(trackData: TrackProgress | null): number {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const initialProgressRef = useRef<number>(0);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!trackData) {
      setProgress(0);
      return;
    }

    const { progress_ms, duration_ms, is_playing, timestamp } = trackData;

    // Set initial progress
    const now = Date.now();
    const timeSinceServerUpdate = now - (timestamp || now);
    const adjustedProgress = is_playing 
      ? Math.min(progress_ms + timeSinceServerUpdate, duration_ms)
      : progress_ms;

    setProgress(adjustedProgress);

    // Only simulate if playing
    if (!is_playing || adjustedProgress >= duration_ms) {
      return;
    }

    // Start real-time simulation
    startTimeRef.current = now;
    initialProgressRef.current = adjustedProgress;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = initialProgressRef.current + elapsed;

      if (newProgress >= duration_ms) {
        setProgress(duration_ms);
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
      } else {
        setProgress(newProgress);
      }
    }, 100); // Update every 100ms for smooth progress

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [trackData]);

  return progress;
}

/**
 * Hook to prevent refreshing during user interactions
 */
export function useInteractionLock() {
  const [isInteracting, setIsInteracting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lockInteraction = (duration = 2000) => {
    setIsInteracting(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, duration);
  };

  const unlockInteraction = () => {
    setIsInteracting(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return { isInteracting, lockInteraction, unlockInteraction };
}
