/**
 * Graceful Degradation Hook
 * 
 * This hook provides React components with access to the graceful degradation system
 * and automatically updates when degradation levels change.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { gracefulDegradation, DegradationLevel, ServiceStatus } from '../lib/error/graceful-degradation';

export interface UseGracefulDegradationReturn {
  currentLevel: DegradationLevel;
  isFeatureAvailable: (feature: string) => boolean;
  getServiceStatus: (serviceName: string) => ServiceStatus | null;
  getAllServiceStatuses: () => ServiceStatus[];
  isServiceAvailable: (serviceName: string) => boolean;
  isServiceDegraded: (serviceName: string) => boolean;
  executeWithFallback: <T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback: () => T
  ) => Promise<T>;
}

export function useGracefulDegradation(): UseGracefulDegradationReturn {
  const [currentLevel, setCurrentLevel] = useState<DegradationLevel>(
    gracefulDegradation.getCurrentLevel()
  );

  // Update degradation level when it changes
  useEffect(() => {
    const handleLevelChange = (newLevel: DegradationLevel) => {
      setCurrentLevel(newLevel);
    };

    gracefulDegradation.addListener(handleLevelChange);

    return () => {
      gracefulDegradation.removeListener(handleLevelChange);
    };
  }, []);

  const isFeatureAvailable = useCallback((feature: string): boolean => {
    return gracefulDegradation.isFeatureAvailable(feature);
  }, []);

  const getServiceStatus = useCallback((serviceName: string): ServiceStatus | null => {
    return gracefulDegradation.getServiceStatus(serviceName);
  }, []);

  const getAllServiceStatuses = useCallback((): ServiceStatus[] => {
    return gracefulDegradation.getAllServiceStatuses();
  }, []);

  const isServiceAvailable = useCallback((serviceName: string): boolean => {
    const status = gracefulDegradation.getServiceStatus(serviceName);
    return status?.available || false;
  }, []);

  const isServiceDegraded = useCallback((serviceName: string): boolean => {
    const status = gracefulDegradation.getServiceStatus(serviceName);
    return status?.degraded || false;
  }, []);

  const executeWithFallback = useCallback(async <T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<T> => {
    return gracefulDegradation.executeWithFallback(serviceName, operation, fallback);
  }, []);

  return {
    currentLevel,
    isFeatureAvailable,
    getServiceStatus,
    getAllServiceStatuses,
    isServiceAvailable,
    isServiceDegraded,
    executeWithFallback,
  };
}
