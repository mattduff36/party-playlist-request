/**
 * Tests for Load Testing Scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  basicUserScenario, 
  highLoadScenario, 
  stressTestScenario,
  realTimeSyncScenario,
  memoryLeakScenario,
  scenarios,
  getScenario,
  getScenarioNames
} from '../scenarios';

// Mock fetch
global.fetch = jest.fn();

describe('Load Testing Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });
  });

  describe('Basic User Scenario', () => {
    it('should have correct configuration', () => {
      expect(basicUserScenario.name).toBe('Basic User Simulation');
      expect(basicUserScenario.duration).toBe(300);
      expect(basicUserScenario.userCount).toBe(100);
      expect(basicUserScenario.rampUpTime).toBe(60);
      expect(basicUserScenario.actions).toHaveLength(5);
    });

    it('should have weighted actions', () => {
      const totalWeight = basicUserScenario.actions.reduce((sum, action) => sum + action.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it('should execute load_homepage action', async () => {
      const action = basicUserScenario.actions.find(a => a.name === 'load_homepage');
      expect(action).toBeDefined();
      
      await action!.execute();
      expect(global.fetch).toHaveBeenCalledWith('/api/events/current');
    });

    it('should execute submit_request action', async () => {
      const action = basicUserScenario.actions.find(a => a.name === 'submit_request');
      expect(action).toBeDefined();
      
      await action!.execute();
      expect(global.fetch).toHaveBeenCalledWith('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Test Song')
      });
    });
  });

  describe('High Load Scenario', () => {
    it('should have correct configuration', () => {
      expect(highLoadScenario.name).toBe('High Load Simulation');
      expect(highLoadScenario.duration).toBe(600);
      expect(highLoadScenario.userCount).toBe(350);
      expect(highLoadScenario.rampUpTime).toBe(120);
    });

    it('should have rapid request actions', () => {
      const rapidAction = highLoadScenario.actions.find(a => a.name === 'rapid_requests');
      expect(rapidAction).toBeDefined();
      expect(rapidAction!.minDelay).toBe(100);
      expect(rapidAction!.maxDelay).toBe(500);
    });
  });

  describe('Stress Test Scenario', () => {
    it('should have correct configuration', () => {
      expect(stressTestScenario.name).toBe('Stress Test');
      expect(stressTestScenario.duration).toBe(900);
      expect(stressTestScenario.userCount).toBe(500);
      expect(stressTestScenario.rampUpTime).toBe(180);
    });

    it('should have maximum concurrent request actions', () => {
      const maxAction = stressTestScenario.actions.find(a => a.name === 'max_concurrent_requests');
      expect(maxAction).toBeDefined();
      expect(maxAction!.minDelay).toBe(10);
      expect(maxAction!.maxDelay).toBe(100);
    });
  });

  describe('Real-time Sync Scenario', () => {
    it('should have correct configuration', () => {
      expect(realTimeSyncScenario.name).toBe('Real-time Synchronization Test');
      expect(realTimeSyncScenario.duration).toBe(1800);
      expect(realTimeSyncScenario.userCount).toBe(200);
      expect(realTimeSyncScenario.rampUpTime).toBe(300);
    });

    it('should have WebSocket connection actions', () => {
      const wsAction = realTimeSyncScenario.actions.find(a => a.name === 'websocket_connection');
      expect(wsAction).toBeDefined();
    });
  });

  describe('Memory Leak Scenario', () => {
    it('should have correct configuration', () => {
      expect(memoryLeakScenario.name).toBe('Memory Leak Detection');
      expect(memoryLeakScenario.duration).toBe(3600);
      expect(memoryLeakScenario.userCount).toBe(50);
      expect(memoryLeakScenario.rampUpTime).toBe(60);
    });

    it('should have sustained request actions', () => {
      const sustainedAction = memoryLeakScenario.actions.find(a => a.name === 'sustained_requests');
      expect(sustainedAction).toBeDefined();
    });
  });

  describe('Scenario Management', () => {
    it('should return all scenarios', () => {
      expect(scenarios).toHaveLength(5);
      expect(scenarios).toContain(basicUserScenario);
      expect(scenarios).toContain(highLoadScenario);
      expect(scenarios).toContain(stressTestScenario);
      expect(scenarios).toContain(realTimeSyncScenario);
      expect(scenarios).toContain(memoryLeakScenario);
    });

    it('should get scenario by name', () => {
      const scenario = getScenario('Basic User Simulation');
      expect(scenario).toBe(basicUserScenario);
    });

    it('should return undefined for non-existent scenario', () => {
      const scenario = getScenario('Non-existent Scenario');
      expect(scenario).toBeUndefined();
    });

    it('should get all scenario names', () => {
      const names = getScenarioNames();
      expect(names).toHaveLength(5);
      expect(names).toContain('Basic User Simulation');
      expect(names).toContain('High Load Simulation');
      expect(names).toContain('Stress Test');
      expect(names).toContain('Real-time Synchronization Test');
      expect(names).toContain('Memory Leak Detection');
    });
  });

  describe('Action Execution', () => {
    it('should handle action errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const action = basicUserScenario.actions.find(a => a.name === 'load_homepage');
      expect(action).toBeDefined();
      
      await expect(action!.execute()).rejects.toThrow('Network error');
    });

    it('should execute bulk submit requests', async () => {
      const action = highLoadScenario.actions.find(a => a.name === 'bulk_submit_requests');
      expect(action).toBeDefined();
      
      await action!.execute();
      
      // Should make 3 POST requests
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Bulk Song')
      });
    });

    it('should execute concurrent page loads', async () => {
      const action = highLoadScenario.actions.find(a => a.name === 'concurrent_page_loads');
      expect(action).toBeDefined();
      
      await action!.execute();
      
      // Should make 4 concurrent requests
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });
});

