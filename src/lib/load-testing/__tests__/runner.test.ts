/**
 * Tests for Load Testing Runner
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LoadTestRunner, LoadTestConfig } from '../runner';
import { basicUserScenario } from '../scenarios';

// Mock fetch
global.fetch = jest.fn();

describe('LoadTestRunner', () => {
  let config: LoadTestConfig;
  let runner: LoadTestRunner;

  beforeEach(() => {
    config = {
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      maxConcurrentUsers: 100,
      retryAttempts: 3,
      retryDelay: 1000,
      metricsInterval: 1000
    };
    
    runner = new LoadTestRunner(config);
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct config', () => {
      expect(runner.isTestRunning()).toBe(false);
      expect(runner.getCurrentMetrics()).toEqual({
        totalUsers: 0,
        activeUsers: 0,
        completedUsers: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      });
    });
  });

  describe('Basic User Simulation', () => {
    it('should run basic user scenario', async () => {
      const onProgress = jest.fn();
      const onComplete = jest.fn();
      
      // Mock a shorter scenario for testing
      const shortScenario = {
        ...basicUserScenario,
        duration: 1, // 1 second
        userCount: 2, // 2 users
        rampUpTime: 0.5 // 0.5 seconds
      };
      
      const result = await runner.runScenario(shortScenario, onProgress, onComplete);
      
      expect(result.scenario).toBe('Basic User Simulation');
      expect(result.totalUsers).toBe(2);
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(onComplete).toHaveBeenCalledWith(result);
    }, 10000);

    it('should handle user simulation errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const shortScenario = {
        ...basicUserScenario,
        duration: 1,
        userCount: 1,
        rampUpTime: 0.1
      };
      
      const result = await runner.runScenario(shortScenario);
      
      expect(result.failedRequests).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Metrics Collection', () => {
    it('should collect metrics during test', async () => {
      const onProgress = jest.fn();
      
      const shortScenario = {
        ...basicUserScenario,
        duration: 2,
        userCount: 1,
        rampUpTime: 0.1
      };
      
      await runner.runScenario(shortScenario, onProgress);
      
      expect(onProgress).toHaveBeenCalled();
      
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.totalUsers).toBe(1);
      expect(lastCall.totalRequests).toBeGreaterThan(0);
    }, 10000);

    it('should calculate response times correctly', async () => {
      const shortScenario = {
        ...basicUserScenario,
        duration: 1,
        userCount: 1,
        rampUpTime: 0.1
      };
      
      const result = await runner.runScenario(shortScenario);
      
      expect(result.averageResponseTime).toBeGreaterThan(0);
      expect(result.p95ResponseTime).toBeGreaterThan(0);
      expect(result.p99ResponseTime).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Test Control', () => {
    it('should stop test when requested', () => {
      // Test that stop method works
      expect(runner.isTestRunning()).toBe(false);
      
      runner.stop();
      expect(runner.isTestRunning()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
      
      const shortScenario = {
        ...basicUserScenario,
        duration: 1,
        userCount: 1,
        rampUpTime: 0.1
      };
      
      const result = await runner.runScenario(shortScenario);
      
      expect(result.failedRequests).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toBe('Fetch failed');
    }, 10000);

    it('should handle timeout errors', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      const shortScenario = {
        ...basicUserScenario,
        duration: 1,
        userCount: 1,
        rampUpTime: 0.1
      };
      
      const result = await runner.runScenario(shortScenario);
      
      expect(result.failedRequests).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Concurrent Users', () => {
    it('should handle multiple concurrent users', async () => {
      const shortScenario = {
        ...basicUserScenario,
        duration: 2,
        userCount: 5,
        rampUpTime: 0.1
      };
      
      const result = await runner.runScenario(shortScenario);
      
      expect(result.totalUsers).toBe(5);
      expect(result.totalRequests).toBeGreaterThan(0);
    }, 10000);
  });
});
