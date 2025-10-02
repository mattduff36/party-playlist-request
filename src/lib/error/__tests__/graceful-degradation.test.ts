/**
 * Tests for Graceful Degradation System
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GracefulDegradationManager, DegradationConfig } from '../graceful-degradation';

describe('GracefulDegradationManager', () => {
  let manager: GracefulDegradationManager;
  let config: DegradationConfig;

  beforeEach(() => {
    config = {
      services: {
        database: {
          critical: true,
          timeout: 1000,
          retryAttempts: 2,
        },
        redis: {
          critical: false,
          timeout: 500,
          retryAttempts: 1,
        },
        pusher: {
          critical: false,
          timeout: 2000,
          retryAttempts: 3,
        },
      },
      levels: {
        full: {
          level: 'full',
          description: 'All services operational',
          features: {
            realTimeSync: true,
            caching: true,
            adminPanel: true,
          },
        },
        reduced: {
          level: 'reduced',
          description: 'Some services degraded',
          features: {
            realTimeSync: false,
            caching: true,
            adminPanel: true,
          },
        },
        minimal: {
          level: 'minimal',
          description: 'Minimal functionality',
          features: {
            realTimeSync: false,
            caching: false,
            adminPanel: false,
          },
        },
        offline: {
          level: 'offline',
          description: 'System offline',
          features: {
            realTimeSync: false,
            caching: false,
            adminPanel: false,
          },
        },
      },
    };

    manager = new GracefulDegradationManager(config);
  });

  afterEach(() => {
    manager.stopMonitoring();
  });

  describe('Service Management', () => {
    it('should initialize services correctly', () => {
      const statuses = manager.getAllServiceStatuses();
      expect(statuses).toHaveLength(3);
      
      const serviceNames = statuses.map(s => s.name);
      expect(serviceNames).toContain('database');
      expect(serviceNames).toContain('redis');
      expect(serviceNames).toContain('pusher');
    });

    it('should get service status', () => {
      const dbStatus = manager.getServiceStatus('database');
      expect(dbStatus).toBeDefined();
      expect(dbStatus?.name).toBe('database');
      expect(dbStatus?.available).toBe(true);
    });

    it('should return null for non-existent service', () => {
      const status = manager.getServiceStatus('non-existent');
      expect(status).toBeNull();
    });

    it('should force service offline', () => {
      manager.forceServiceOffline('database', 'Test offline');
      
      const status = manager.getServiceStatus('database');
      expect(status?.available).toBe(false);
      expect(status?.error).toBe('Test offline');
    });

    it('should force service online', () => {
      manager.forceServiceOffline('database', 'Test offline');
      manager.forceServiceOnline('database');
      
      const status = manager.getServiceStatus('database');
      expect(status?.available).toBe(true);
      expect(status?.error).toBeUndefined();
    });
  });

  describe('Degradation Levels', () => {
    it('should start with full level', () => {
      const level = manager.getCurrentLevel();
      expect(level.level).toBe('full');
    });

    it('should set degradation level', () => {
      manager.setDegradationLevel('reduced');
      
      const level = manager.getCurrentLevel();
      expect(level.level).toBe('reduced');
    });

    it('should not set invalid degradation level', () => {
      const originalLevel = manager.getCurrentLevel();
      manager.setDegradationLevel('invalid');
      
      const level = manager.getCurrentLevel();
      expect(level).toBe(originalLevel);
    });
  });

  describe('Feature Availability', () => {
    it('should check feature availability', () => {
      expect(manager.isFeatureAvailable('realTimeSync')).toBe(true);
      expect(manager.isFeatureAvailable('caching')).toBe(true);
      expect(manager.isFeatureAvailable('adminPanel')).toBe(true);
    });

    it('should reflect feature availability in reduced mode', () => {
      manager.setDegradationLevel('reduced');
      
      expect(manager.isFeatureAvailable('realTimeSync')).toBe(false);
      expect(manager.isFeatureAvailable('caching')).toBe(true);
      expect(manager.isFeatureAvailable('adminPanel')).toBe(true);
    });

    it('should reflect feature availability in minimal mode', () => {
      manager.setDegradationLevel('minimal');
      
      expect(manager.isFeatureAvailable('realTimeSync')).toBe(false);
      expect(manager.isFeatureAvailable('caching')).toBe(false);
      expect(manager.isFeatureAvailable('adminPanel')).toBe(false);
    });

    it('should return false for unknown features', () => {
      expect(manager.isFeatureAvailable('unknownFeature')).toBe(false);
    });
  });

  describe('Execute with Fallback', () => {
    it('should execute operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn().mockReturnValue('fallback');
      
      const result = await manager.executeWithFallback('database', operation, fallback);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should execute fallback on operation failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockReturnValue('fallback');
      
      const result = await manager.executeWithFallback('database', operation, fallback);
      
      expect(result).toBe('fallback');
      expect(operation).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should execute fallback on timeout', async () => {
      const operation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );
      const fallback = jest.fn().mockReturnValue('fallback');
      
      const result = await manager.executeWithFallback('database', operation, fallback);
      
      expect(result).toBe('fallback');
      expect(operation).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw error for unconfigured service', async () => {
      const operation = jest.fn();
      const fallback = jest.fn();
      
      await expect(
        manager.executeWithFallback('unconfigured', operation, fallback)
      ).rejects.toThrow('Service unconfigured not configured');
    });
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring', () => {
      const startSpy = jest.spyOn(manager, 'checkAllServices');
      
      manager.startMonitoring(100);
      
      // Wait for at least one check
      return new Promise(resolve => {
        setTimeout(() => {
          expect(startSpy).toHaveBeenCalled();
          manager.stopMonitoring();
          resolve(undefined);
        }, 150);
      });
    });

    it('should not start monitoring if already running', () => {
      const startSpy = jest.spyOn(manager, 'checkAllServices');
      
      manager.startMonitoring(100);
      manager.startMonitoring(100); // Try to start again
      
      // Should only start once
      expect(startSpy).toHaveBeenCalledTimes(1);
      
      manager.stopMonitoring();
    });
  });

  describe('Listeners', () => {
    it('should add and remove listeners', () => {
      const listener = jest.fn();
      
      manager.addListener(listener);
      
      // Trigger level change
      manager.setDegradationLevel('reduced');
      
      expect(listener).toHaveBeenCalled();
      
      // Remove listener and trigger another change
      manager.removeListener(listener);
      manager.setDegradationLevel('minimal');
      
      // Should only have been called once (before removal)
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify listeners on level change', () => {
      const listener = jest.fn();
      manager.addListener(listener);
      
      manager.setDegradationLevel('reduced');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'reduced' })
      );
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();
      
      manager.addListener(errorListener);
      manager.addListener(normalListener);
      
      // Should not throw and should call normal listener
      expect(() => {
        manager.setDegradationLevel('reduced');
      }).not.toThrow();
      
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('Level Updates', () => {
    it('should update to offline when critical service fails', () => {
      manager.forceServiceOffline('database', 'Critical failure');
      
      const level = manager.getCurrentLevel();
      expect(level.level).toBe('offline');
    });

    it('should update to minimal when multiple services fail', () => {
      // Mark services as degraded (not offline) - need more than 2 for minimal level
      manager.serviceStatus.set('redis', {
        name: 'redis',
        available: true,
        degraded: true,
        lastCheck: Date.now(),
      });
      manager.serviceStatus.set('pusher', {
        name: 'pusher',
        available: true,
        degraded: true,
        lastCheck: Date.now(),
      });
      // Add a third degraded service to trigger minimal level
      manager.serviceStatus.set('database', {
        name: 'database',
        available: true,
        degraded: true,
        lastCheck: Date.now(),
      });
      
      // Manually trigger level update
      (manager as any).updateDegradationLevel();
      
      const level = manager.getCurrentLevel();
      expect(level.level).toBe('minimal');
    });

    it('should update to reduced when some services fail', () => {
      // Mark service as degraded (not offline)
      manager.serviceStatus.set('redis', {
        name: 'redis',
        available: true,
        degraded: true,
        lastCheck: Date.now(),
      });
      
      // Manually trigger level update
      (manager as any).updateDegradationLevel();
      
      const level = manager.getCurrentLevel();
      expect(level.level).toBe('reduced');
    });

    it('should stay full when no services fail', () => {
      const level = manager.getCurrentLevel();
      expect(level.level).toBe('full');
    });
  });
});
