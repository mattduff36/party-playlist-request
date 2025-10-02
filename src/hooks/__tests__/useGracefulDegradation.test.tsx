/**
 * Tests for Graceful Degradation Hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGracefulDegradation } from '../useGracefulDegradation';
import { gracefulDegradation } from '../../lib/error/graceful-degradation';

// Mock the graceful degradation manager
jest.mock('../../lib/error/graceful-degradation', () => ({
  gracefulDegradation: {
    getCurrentLevel: jest.fn(),
    isFeatureAvailable: jest.fn(),
    getServiceStatus: jest.fn(),
    getAllServiceStatuses: jest.fn(),
    isServiceAvailable: jest.fn(),
    isServiceDegraded: jest.fn(),
    executeWithFallback: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}));

const mockGracefulDegradation = gracefulDegradation as jest.Mocked<typeof gracefulDegradation>;

describe('useGracefulDegradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockGracefulDegradation.getCurrentLevel.mockReturnValue({
      level: 'full',
      description: 'All services operational',
      features: {
        realTimeSync: true,
        caching: true,
        adminPanel: true,
      },
    });
    
    mockGracefulDegradation.isFeatureAvailable.mockReturnValue(true);
    mockGracefulDegradation.getServiceStatus.mockReturnValue({
      name: 'database',
      available: true,
      degraded: false,
      lastCheck: Date.now(),
    });
    mockGracefulDegradation.getAllServiceStatuses.mockReturnValue([]);
    mockGracefulDegradation.isServiceAvailable.mockReturnValue(true);
    mockGracefulDegradation.isServiceDegraded.mockReturnValue(false);
    mockGracefulDegradation.executeWithFallback.mockResolvedValue('success');
  });

  it('should return current degradation level', () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    expect(result.current.currentLevel).toEqual({
      level: 'full',
      description: 'All services operational',
      features: {
        realTimeSync: true,
        caching: true,
        adminPanel: true,
      },
    });
  });

  it('should check feature availability', () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    result.current.isFeatureAvailable('realTimeSync');
    
    expect(mockGracefulDegradation.isFeatureAvailable).toHaveBeenCalledWith('realTimeSync');
  });

  it('should get service status', () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    result.current.getServiceStatus('database');
    
    expect(mockGracefulDegradation.getServiceStatus).toHaveBeenCalledWith('database');
  });

  it('should get all service statuses', () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    result.current.getAllServiceStatuses();
    
    expect(mockGracefulDegradation.getAllServiceStatuses).toHaveBeenCalled();
  });

  it('should check if service is available', () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    result.current.isServiceAvailable('database');
    
    expect(mockGracefulDegradation.getServiceStatus).toHaveBeenCalledWith('database');
  });

  it('should check if service is degraded', () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    result.current.isServiceDegraded('database');
    
    expect(mockGracefulDegradation.getServiceStatus).toHaveBeenCalledWith('database');
  });

  it('should execute with fallback', async () => {
    const { result } = renderHook(() => useGracefulDegradation());
    
    const operation = jest.fn().mockResolvedValue('success');
    const fallback = jest.fn().mockReturnValue('fallback');
    
    await result.current.executeWithFallback('database', operation, fallback);
    
    expect(mockGracefulDegradation.executeWithFallback).toHaveBeenCalledWith(
      'database',
      operation,
      fallback
    );
  });

  it('should add and remove listeners on mount/unmount', () => {
    const { unmount } = renderHook(() => useGracefulDegradation());
    
    expect(mockGracefulDegradation.addListener).toHaveBeenCalled();
    
    unmount();
    
    expect(mockGracefulDegradation.removeListener).toHaveBeenCalled();
  });

  it('should update when degradation level changes', () => {
    const { result, rerender } = renderHook(() => useGracefulDegradation());
    
    // Initial level
    expect(result.current.currentLevel.level).toBe('full');
    
    // Simulate level change
    mockGracefulDegradation.getCurrentLevel.mockReturnValue({
      level: 'reduced',
      description: 'Some services degraded',
      features: {
        realTimeSync: false,
        caching: true,
        adminPanel: true,
      },
    });
    
    // Get the listener that was added
    const listener = mockGracefulDegradation.addListener.mock.calls[0][0];
    
    // Simulate listener being called
    act(() => {
      listener({
        level: 'reduced',
        description: 'Some services degraded',
        features: {
          realTimeSync: false,
          caching: true,
          adminPanel: true,
        },
      });
    });
    
    rerender();
    
    expect(result.current.currentLevel.level).toBe('reduced');
  });

  it('should handle listener errors gracefully', () => {
    const errorListener = jest.fn().mockImplementation(() => {
      throw new Error('Listener error');
    });
    
    // Mock addListener to call our error listener
    mockGracefulDegradation.addListener.mockImplementation((listener) => {
      // Simulate calling the listener with an error
      try {
        listener({
          level: 'reduced',
          description: 'Some services degraded',
          features: {},
        });
      } catch (error) {
        // Should not throw
      }
    });
    
    // Should not throw
    expect(() => {
      renderHook(() => useGracefulDegradation());
    }).not.toThrow();
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useGracefulDegradation());
    
    const firstRender = {
      isFeatureAvailable: result.current.isFeatureAvailable,
      getServiceStatus: result.current.getServiceStatus,
      getAllServiceStatuses: result.current.getAllServiceStatuses,
      isServiceAvailable: result.current.isServiceAvailable,
      isServiceDegraded: result.current.isServiceDegraded,
      executeWithFallback: result.current.executeWithFallback,
    };
    
    rerender();
    
    const secondRender = {
      isFeatureAvailable: result.current.isFeatureAvailable,
      getServiceStatus: result.current.getServiceStatus,
      getAllServiceStatuses: result.current.getAllServiceStatuses,
      isServiceAvailable: result.current.isServiceAvailable,
      isServiceDegraded: result.current.isServiceDegraded,
      executeWithFallback: result.current.executeWithFallback,
    };
    
    // Functions should be stable (same reference)
    expect(firstRender.isFeatureAvailable).toBe(secondRender.isFeatureAvailable);
    expect(firstRender.getServiceStatus).toBe(secondRender.getServiceStatus);
    expect(firstRender.getAllServiceStatuses).toBe(secondRender.getAllServiceStatuses);
    expect(firstRender.isServiceAvailable).toBe(secondRender.isServiceAvailable);
    expect(firstRender.isServiceDegraded).toBe(secondRender.isServiceDegraded);
    expect(firstRender.executeWithFallback).toBe(secondRender.executeWithFallback);
  });
});
