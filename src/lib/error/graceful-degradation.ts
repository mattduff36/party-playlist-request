/**
 * Graceful Degradation System
 * 
 * This module provides comprehensive graceful degradation functionality
 * for handling service failures and maintaining system functionality.
 */

export interface DegradationLevel {
  level: 'full' | 'reduced' | 'minimal' | 'offline';
  description: string;
  features: {
    [key: string]: boolean;
  };
}

export interface ServiceStatus {
  name: string;
  available: boolean;
  degraded: boolean;
  lastCheck: number;
  error?: string;
  fallback?: string;
}

export interface DegradationConfig {
  services: {
    [key: string]: {
      critical: boolean;
      fallback?: () => void;
      timeout: number;
      retryAttempts: number;
    };
  };
  levels: {
    [key: string]: DegradationLevel;
  };
}

export class GracefulDegradationManager {
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private currentLevel: DegradationLevel;
  private config: DegradationConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(level: DegradationLevel) => void> = new Set();

  constructor(config: DegradationConfig) {
    this.config = config;
    this.currentLevel = config.levels.full;
    this.initializeServices();
  }

  /**
   * Start monitoring services
   */
  startMonitoring(intervalMs: number = 30000) {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAllServices();
    }, intervalMs);

    // Initial check
    this.checkAllServices();
  }

  /**
   * Stop monitoring services
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Add a service status listener
   */
  addListener(listener: (level: DegradationLevel) => void) {
    this.listeners.add(listener);
  }

  /**
   * Remove a service status listener
   */
  removeListener(listener: (level: DegradationLevel) => void) {
    this.listeners.delete(listener);
  }

  /**
   * Get current degradation level
   */
  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName: string): ServiceStatus | null {
    return this.serviceStatus.get(serviceName) || null;
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatus.values());
  }

  /**
   * Check if a feature is available
   */
  isFeatureAvailable(feature: string): boolean {
    return this.currentLevel.features[feature] || false;
  }

  /**
   * Manually set degradation level
   */
  setDegradationLevel(level: string) {
    const newLevel = this.config.levels[level];
    if (newLevel) {
      this.currentLevel = newLevel;
      this.notifyListeners();
    }
  }

  /**
   * Force service offline
   */
  forceServiceOffline(serviceName: string, reason: string) {
    this.serviceStatus.set(serviceName, {
      name: serviceName,
      available: false,
      degraded: false,
      lastCheck: Date.now(),
      error: reason,
    });
    this.updateDegradationLevel();
  }

  /**
   * Force service online
   */
  forceServiceOnline(serviceName: string) {
    this.serviceStatus.set(serviceName, {
      name: serviceName,
      available: true,
      degraded: false,
      lastCheck: Date.now(),
    });
    this.updateDegradationLevel();
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    const serviceConfig = this.config.services[serviceName];
    if (!serviceConfig) {
      throw new Error(`Service ${serviceName} not configured`);
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), serviceConfig.timeout)
        ),
      ]);

      // Mark service as available
      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: true,
        degraded: false,
        lastCheck: Date.now(),
      });

      return result;
    } catch (error) {
      // Mark service as unavailable
      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: false,
        degraded: false,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Execute fallback
      if (serviceConfig.fallback) {
        serviceConfig.fallback();
      }

      return fallback();
    }
  }

  private initializeServices() {
    Object.keys(this.config.services).forEach(serviceName => {
      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: true,
        degraded: false,
        lastCheck: 0,
      });
    });
  }

  private async checkAllServices() {
    const checkPromises = Object.keys(this.config.services).map(serviceName =>
      this.checkService(serviceName)
    );

    await Promise.allSettled(checkPromises);
    this.updateDegradationLevel();
  }

  private async checkService(serviceName: string) {
    const serviceConfig = this.config.services[serviceName];
    const startTime = Date.now();

    try {
      // Simulate service check (in real implementation, this would be actual service calls)
      await this.simulateServiceCheck(serviceName);
      
      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: true,
        degraded: false,
        lastCheck: Date.now(),
      });
    } catch (error) {
      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: false,
        degraded: false,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async simulateServiceCheck(serviceName: string): Promise<void> {
    // Simulate different service checks
    switch (serviceName) {
      case 'database':
        return this.checkDatabase();
      case 'redis':
        return this.checkRedis();
      case 'pusher':
        return this.checkPusher();
      case 'spotify':
        return this.checkSpotify();
      default:
        // Simulate random failures for testing
        if (Math.random() < 0.1) { // 10% failure rate
          throw new Error('Simulated service failure');
        }
    }
  }

  private async checkDatabase(): Promise<void> {
    // In real implementation, this would check database connectivity
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async checkRedis(): Promise<void> {
    // In real implementation, this would check Redis connectivity
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async checkPusher(): Promise<void> {
    // In real implementation, this would check Pusher connectivity
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async checkSpotify(): Promise<void> {
    // In real implementation, this would check Spotify API connectivity
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private updateDegradationLevel() {
    const services = Array.from(this.serviceStatus.values());
    const criticalServices = services.filter(service => 
      this.config.services[service.name]?.critical
    );

    const unavailableCritical = criticalServices.filter(service => !service.available);
    const degradedServices = services.filter(service => service.degraded);

    let newLevel: DegradationLevel;

    if (unavailableCritical.length > 0) {
      // Critical services are down
      newLevel = this.config.levels.offline;
    } else if (degradedServices.length > 2) {
      // Multiple services degraded
      newLevel = this.config.levels.minimal;
    } else if (degradedServices.length > 0) {
      // Some services degraded
      newLevel = this.config.levels.reduced;
    } else {
      // All services working
      newLevel = this.config.levels.full;
    }

    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentLevel);
      } catch (error) {
        console.error('Error in degradation listener:', error);
      }
    });
  }
}

// Default configuration
const defaultConfig: DegradationConfig = {
  services: {
    database: {
      critical: true,
      timeout: 5000,
      retryAttempts: 3,
    },
    redis: {
      critical: false,
      timeout: 3000,
      retryAttempts: 2,
    },
    pusher: {
      critical: false,
      timeout: 5000,
      retryAttempts: 3,
    },
    spotify: {
      critical: false,
      timeout: 10000,
      retryAttempts: 2,
    },
  },
  levels: {
    full: {
      level: 'full',
      description: 'All services operational',
      features: {
        realTimeSync: true,
        caching: true,
        spotifyIntegration: true,
        adminPanel: true,
        requestSubmission: true,
        displayUpdates: true,
      },
    },
    reduced: {
      level: 'reduced',
      description: 'Some services degraded, core functionality available',
      features: {
        realTimeSync: false,
        caching: true,
        spotifyIntegration: false,
        adminPanel: true,
        requestSubmission: true,
        displayUpdates: true,
      },
    },
    minimal: {
      level: 'minimal',
      description: 'Minimal functionality, basic features only',
      features: {
        realTimeSync: false,
        caching: false,
        spotifyIntegration: false,
        adminPanel: false,
        requestSubmission: true,
        displayUpdates: false,
      },
    },
    offline: {
      level: 'offline',
      description: 'System offline, maintenance mode',
      features: {
        realTimeSync: false,
        caching: false,
        spotifyIntegration: false,
        adminPanel: false,
        requestSubmission: false,
        displayUpdates: false,
      },
    },
  },
};

// Singleton instance
export const gracefulDegradation = new GracefulDegradationManager(defaultConfig);

// Auto-start monitoring in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  gracefulDegradation.startMonitoring(30000); // Check every 30 seconds
}
