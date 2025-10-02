/**
 * Debugging Tools
 * 
 * This module provides debugging utilities and tools for development
 * and production debugging.
 */

import { logger, LogLevel } from './logger';

export interface DebugConfig {
  enableConsole: boolean;
  enablePerformance: boolean;
  enableMemoryTracking: boolean;
  enableNetworkTracking: boolean;
  enableErrorTracking: boolean;
  enableUserTracking: boolean;
  maxLogEntries: number;
  enableHotReload: boolean;
}

export class DebugTools {
  private config: DebugConfig;
  private performanceTimers: Map<string, number> = new Map();
  private memorySnapshots: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private networkRequests: Array<{ url: string; method: string; duration: number; status: number }> = [];
  private errorCounts: Map<string, number> = new Map();

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enableConsole: true,
      enablePerformance: true,
      enableMemoryTracking: true,
      enableNetworkTracking: true,
      enableErrorTracking: true,
      enableUserTracking: true,
      maxLogEntries: 1000,
      enableHotReload: false,
      ...config
    };

    this.initializeTracking();
  }

  private initializeTracking(): void {
    if (this.config.enableMemoryTracking) {
      this.startMemoryTracking();
    }

    if (this.config.enableNetworkTracking) {
      this.startNetworkTracking();
    }

    if (this.config.enableErrorTracking) {
      this.startErrorTracking();
    }
  }

  /**
   * Start memory tracking
   */
  private startMemoryTracking(): void {
    setInterval(() => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        this.memorySnapshots.push({
          timestamp: Date.now(),
          usage
        });

        // Keep only recent snapshots
        if (this.memorySnapshots.length > this.config.maxLogEntries) {
          this.memorySnapshots = this.memorySnapshots.slice(-this.config.maxLogEntries);
        }

        // Log memory warnings
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        if (heapUsedMB > 500) {
          logger.warn('High memory usage detected', {
            heapUsed: `${heapUsedMB.toFixed(2)}MB`,
            heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
            external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start network tracking
   */
  private startNetworkTracking(): void {
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const startTime = Date.now();
        const url = args[0] as string;
        const method = (args[1] as RequestInit)?.method || 'GET';

        try {
          const response = await originalFetch(...args);
          const duration = Date.now() - startTime;
          
          this.networkRequests.push({
            url,
            method,
            duration,
            status: response.status
          });

          // Log slow requests
          if (duration > 5000) {
            logger.warn('Slow network request detected', {
              url,
              method,
              duration: `${duration}ms`,
              status: response.status
            });
          }

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          this.networkRequests.push({
            url,
            method,
            duration,
            status: 0
          });

          logger.error('Network request failed', error as Error, {
            url,
            method,
            duration: `${duration}ms`
          });

          throw error;
        }
      };
    }
  }

  /**
   * Start error tracking
   */
  private startErrorTracking(): void {
    if (typeof window !== 'undefined') {
      // Track unhandled errors
      window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message);
        this.trackError('unhandled_error', error);
      });

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        this.trackError('unhandled_promise_rejection', error);
      });
    }
  }

  /**
   * Track error occurrence
   */
  private trackError(type: string, error: Error): void {
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, count + 1);

    logger.error(`Error tracked: ${type}`, error, {
      errorType: type,
      errorCount: count + 1,
      errorMessage: error.message,
      errorStack: error.stack
    });
  }

  /**
   * Start performance timer
   */
  startTimer(name: string): void {
    if (this.config.enablePerformance) {
      this.performanceTimers.set(name, Date.now());
    }
  }

  /**
   * End performance timer
   */
  endTimer(name: string): number | null {
    if (this.config.enablePerformance) {
      const startTime = this.performanceTimers.get(name);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.performanceTimers.delete(name);
        
        logger.info(`Performance timer: ${name}`, {
          timer: name,
          duration: `${duration}ms`
        });

        return duration;
      }
    }
    return null;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    // Active timers
    const activeTimers = Array.from(this.performanceTimers.entries()).map(([name, startTime]) => ({
      name,
      duration: Date.now() - startTime
    }));
    metrics.activeTimers = activeTimers;

    // Network requests
    if (this.networkRequests.length > 0) {
      const totalRequests = this.networkRequests.length;
      const avgDuration = this.networkRequests.reduce((sum, req) => sum + req.duration, 0) / totalRequests;
      const slowRequests = this.networkRequests.filter(req => req.duration > 5000).length;
      const errorRequests = this.networkRequests.filter(req => req.status >= 400).length;

      metrics.network = {
        totalRequests,
        averageDuration: `${avgDuration.toFixed(2)}ms`,
        slowRequests,
        errorRequests,
        errorRate: `${((errorRequests / totalRequests) * 100).toFixed(2)}%`
      };
    }

    // Memory usage
    if (this.memorySnapshots.length > 0) {
      const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
      metrics.memory = {
        heapUsed: `${(latest.usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(latest.usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        external: `${(latest.usage.external / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(latest.usage.rss / 1024 / 1024).toFixed(2)}MB`
      };
    }

    // Error counts
    metrics.errors = Object.fromEntries(this.errorCounts.entries());

    return metrics;
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Node.js',
      url: typeof window !== 'undefined' ? window.location.href : 'Server',
      performance: this.getPerformanceMetrics(),
      logs: logger.getLogStatistics()
    };
  }

  /**
   * Export debug data
   */
  exportDebugData(): string {
    const debugData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      performance: this.getPerformanceMetrics(),
      memorySnapshots: this.memorySnapshots.slice(-100), // Last 100 snapshots
      networkRequests: this.networkRequests.slice(-100), // Last 100 requests
      errorCounts: Object.fromEntries(this.errorCounts.entries()),
      logs: logger.getLogStatistics()
    };

    return JSON.stringify(debugData, null, 2);
  }

  /**
   * Clear debug data
   */
  clearDebugData(): void {
    this.performanceTimers.clear();
    this.memorySnapshots = [];
    this.networkRequests = [];
    this.errorCounts.clear();
    logger.clearLogs();
  }

  /**
   * Enable hot reload debugging
   */
  enableHotReload(): void {
    if (this.config.enableHotReload && typeof window !== 'undefined') {
      // This would be implemented based on your hot reload system
      logger.info('Hot reload debugging enabled');
    }
  }

  /**
   * Create debug panel HTML
   */
  createDebugPanel(): string {
    return `
      <div id="debug-panel" style="
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        max-height: 400px;
        background: #1a1a1a;
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        overflow-y: auto;
        border: 1px solid #333;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong>Debug Panel</strong>
          <button onclick="document.getElementById('debug-panel').style.display='none'" style="background: #ff4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">×</button>
        </div>
        <div id="debug-content">
          <div>Performance: <span id="debug-performance">Loading...</span></div>
          <div>Memory: <span id="debug-memory">Loading...</span></div>
          <div>Network: <span id="debug-network">Loading...</span></div>
          <div>Errors: <span id="debug-errors">Loading...</span></div>
        </div>
        <div style="margin-top: 10px;">
          <button onclick="window.debugTools.exportDebugData()" style="background: #4444ff; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Export</button>
          <button onclick="window.debugTools.clearDebugData()" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Clear</button>
        </div>
      </div>
    `;
  }

  /**
   * Inject debug panel into page
   */
  injectDebugPanel(): void {
    if (typeof window !== 'undefined' && this.config.enableConsole) {
      const panel = this.createDebugPanel();
      document.body.insertAdjacentHTML('beforeend', panel);
      
      // Make debug tools available globally
      (window as any).debugTools = this;
      
      // Update panel content periodically
      setInterval(() => {
        this.updateDebugPanel();
      }, 1000);
    }
  }

  /**
   * Update debug panel content
   */
  private updateDebugPanel(): void {
    if (typeof window !== 'undefined') {
      const performanceEl = document.getElementById('debug-performance');
      const memoryEl = document.getElementById('debug-memory');
      const networkEl = document.getElementById('debug-network');
      const errorsEl = document.getElementById('debug-errors');

      if (performanceEl) {
        const metrics = this.getPerformanceMetrics();
        performanceEl.textContent = `${metrics.activeTimers?.length || 0} timers`;
      }

      if (memoryEl && this.memorySnapshots.length > 0) {
        const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
        memoryEl.textContent = `${(latest.usage.heapUsed / 1024 / 1024).toFixed(1)}MB`;
      }

      if (networkEl) {
        networkEl.textContent = `${this.networkRequests.length} requests`;
      }

      if (errorsEl) {
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        errorsEl.textContent = `${totalErrors} errors`;
      }
    }
  }
}

// Create default debug tools instance
export const debugTools = new DebugTools({
  enableConsole: true,
  enablePerformance: true,
  enableMemoryTracking: true,
  enableNetworkTracking: true,
  enableErrorTracking: true,
  enableUserTracking: true,
  maxLogEntries: 1000,
  enableHotReload: false
});

// Export convenience functions
export const startTimer = (name: string) => debugTools.startTimer(name);
export const endTimer = (name: string) => debugTools.endTimer(name);
export const getDebugInfo = () => debugTools.getDebugInfo();
export const exportDebugData = () => debugTools.exportDebugData();
export const clearDebugData = () => debugTools.clearDebugData();

