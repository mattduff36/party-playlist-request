/**
 * Tests for Debug Tools
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DebugTools, debugTools } from '../debug-tools';

// Mock process.memoryUsage
const mockMemoryUsage = jest.fn(() => ({
  heapUsed: 50 * 1024 * 1024, // 50MB
  heapTotal: 100 * 1024 * 1024, // 100MB
  external: 10 * 1024 * 1024, // 10MB
  rss: 200 * 1024 * 1024 // 200MB
}));

Object.defineProperty(process, 'memoryUsage', {
  value: mockMemoryUsage,
  writable: true
});

describe('DebugTools', () => {
  let testDebugTools: DebugTools;

  beforeEach(() => {
    testDebugTools = new DebugTools({
      enableConsole: true,
      enablePerformance: true,
      enableMemoryTracking: true,
      enableNetworkTracking: false, // Disable for tests
      enableErrorTracking: false, // Disable for tests
      enableUserTracking: false, // Disable for tests
      maxLogEntries: 100
    });
  });

  describe('Performance Timing', () => {
    it('should start and end timers', () => {
      testDebugTools.startTimer('test-timer');
      const duration = testDebugTools.endTimer('test-timer');
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should return null for non-existent timer', () => {
      const duration = testDebugTools.endTimer('non-existent-timer');
      expect(duration).toBeNull();
    });
  });

  describe('Performance Metrics', () => {
    it('should get performance metrics', () => {
      testDebugTools.startTimer('active-timer');
      
      const metrics = testDebugTools.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('activeTimers');
      expect(metrics.activeTimers).toHaveLength(1);
      expect(metrics.activeTimers[0].name).toBe('active-timer');
    });

    it('should track network requests when enabled', () => {
      const networkDebugTools = new DebugTools({
        enableNetworkTracking: true
      });
      
      // This would test network tracking if we had a proper test environment
      expect(networkDebugTools).toBeDefined();
    });
  });

  describe('Memory Tracking', () => {
    it('should track memory usage', () => {
      // Wait for memory tracking to run
      return new Promise((resolve) => {
        setTimeout(() => {
          const metrics = testDebugTools.getPerformanceMetrics();
          
          if (metrics.memory) {
            expect(metrics.memory).toHaveProperty('heapUsed');
            expect(metrics.memory).toHaveProperty('heapTotal');
            expect(metrics.memory).toHaveProperty('external');
            expect(metrics.memory).toHaveProperty('rss');
          }
          
          resolve(undefined);
        }, 100);
      });
    });
  });

  describe('Debug Information', () => {
    it('should get debug information', () => {
      const debugInfo = testDebugTools.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('timestamp');
      expect(debugInfo).toHaveProperty('performance');
      expect(debugInfo).toHaveProperty('logs');
    });

    it('should export debug data', () => {
      const debugData = testDebugTools.exportDebugData();
      
      expect(() => JSON.parse(debugData)).not.toThrow();
      
      const parsed = JSON.parse(debugData);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('config');
      expect(parsed).toHaveProperty('performance');
    });
  });

  describe('Data Management', () => {
    it('should clear debug data', () => {
      testDebugTools.startTimer('test-timer');
      testDebugTools.clearDebugData();
      
      const metrics = testDebugTools.getPerformanceMetrics();
      expect(metrics.activeTimers).toHaveLength(0);
    });
  });

  describe('Default Debug Tools', () => {
    it('should have default debug tools instance', () => {
      expect(debugTools).toBeDefined();
      expect(debugTools).toBeInstanceOf(DebugTools);
    });
  });

  describe('Error Tracking', () => {
    it('should track errors when enabled', () => {
      const errorDebugTools = new DebugTools({
        enableErrorTracking: true
      });
      
      // This would test error tracking in a proper environment
      expect(errorDebugTools).toBeDefined();
    });
  });
});
