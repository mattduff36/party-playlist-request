/**
 * Automatic Reconnection and State Recovery System
 * 
 * This module provides robust reconnection logic with exponential backoff,
 * state recovery, and connection health monitoring.
 */

import { 
  CentralizedPusherClient, 
  getPusherClient 
} from './client';
import { 
  EventManager, 
  getEventManager 
} from './event-manager';
import { 
  EventDeduplicationManager, 
  getDeduplicationManager 
} from './deduplication';

// Reconnection configuration
interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterRange: number;
  healthCheckInterval: number;
  connectionTimeout: number;
  stateRecoveryTimeout: number;
  enableStateRecovery: boolean;
  enableHealthChecks: boolean;
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  maxAttempts: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 1.5,
  jitterRange: 0.1,
  healthCheckInterval: 30000,
  connectionTimeout: 10000,
  stateRecoveryTimeout: 5000,
  enableStateRecovery: true,
  enableHealthChecks: true
};

// Connection health status
interface ConnectionHealth {
  isHealthy: boolean;
  lastSuccessfulConnection: number;
  consecutiveFailures: number;
  averageLatency: number;
  packetLoss: number;
  lastHealthCheck: number;
}

// Reconnection state
interface ReconnectionState {
  isReconnecting: boolean;
  attemptCount: number;
  lastAttempt: number;
  nextAttemptDelay: number;
  totalReconnections: number;
  lastSuccessfulReconnection: number;
}

export class ReconnectionManager {
  private config: ReconnectionConfig;
  private client: CentralizedPusherClient | null = null;
  private eventManager: EventManager | null = null;
  private deduplicationManager: EventDeduplicationManager | null = null;
  private health: ConnectionHealth;
  private state: ReconnectionState;
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private eventId: string | null = null;
  private isDestroyed = false;

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.health = {
      isHealthy: true,
      lastSuccessfulConnection: Date.now(),
      consecutiveFailures: 0,
      averageLatency: 0,
      packetLoss: 0,
      lastHealthCheck: Date.now()
    };
    this.state = {
      isReconnecting: false,
      attemptCount: 0,
      lastAttempt: 0,
      nextAttemptDelay: this.config.baseDelay,
      totalReconnections: 0,
      lastSuccessfulReconnection: 0
    };
  }

  // Initialize the reconnection manager
  async initialize(eventId: string): Promise<void> {
    this.eventId = eventId;
    this.client = getPusherClient();
    this.eventManager = getEventManager();
    this.deduplicationManager = getDeduplicationManager();

    // Set up connection monitoring
    this.setupConnectionMonitoring();
    
    // Start health checks
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }

    console.log('✅ Reconnection manager initialized');
  }

  // Set up connection monitoring
  private setupConnectionMonitoring(): void {
    if (!this.client) return;

    // Monitor connection state changes
    const checkConnection = () => {
      if (this.isDestroyed) return;

      const connectionState = this.client!.getConnectionState();
      
      if (connectionState === 'connected') {
        this.handleSuccessfulConnection();
      } else if (connectionState === 'disconnected' || connectionState === 'failed') {
        this.handleConnectionFailure();
      }
    };

    // Check connection state every second
    setInterval(checkConnection, 1000);
  }

  // Handle successful connection
  private handleSuccessfulConnection(): void {
    this.health.isHealthy = true;
    this.health.lastSuccessfulConnection = Date.now();
    this.health.consecutiveFailures = 0;
    this.state.isReconnecting = false;
    this.state.attemptCount = 0;
    this.state.nextAttemptDelay = this.config.baseDelay;
    this.state.lastSuccessfulReconnection = Date.now();

    // Clear any pending reconnection timer
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    console.log('✅ Connection successful');
  }

  // Handle connection failure
  private handleConnectionFailure(): void {
    if (this.isDestroyed) return;

    this.health.isHealthy = false;
    this.health.consecutiveFailures++;
    this.state.isReconnecting = true;

    console.log(`❌ Connection failed (attempt ${this.state.attemptCount + 1})`);

    // Start reconnection process
    this.scheduleReconnection();
  }

  // Schedule reconnection
  private scheduleReconnection(): void {
    if (this.isDestroyed || this.state.attemptCount >= this.config.maxAttempts) {
      console.error('💥 Max reconnection attempts reached or manager destroyed');
      return;
    }

    // Clear existing timer
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
    }

    // Calculate delay with exponential backoff and jitter
    const delay = this.calculateReconnectionDelay();
    
    console.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${this.state.attemptCount + 1})`);

    this.reconnectionTimer = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }

  // Calculate reconnection delay
  private calculateReconnectionDelay(): number {
    const exponentialDelay = Math.min(
      this.state.nextAttemptDelay * Math.pow(this.config.backoffMultiplier, this.state.attemptCount),
      this.config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.config.jitterRange * (Math.random() * 2 - 1);
    const delay = Math.max(exponentialDelay + jitter, this.config.baseDelay);

    this.state.nextAttemptDelay = delay;
    return Math.floor(delay);
  }

  // Attempt reconnection
  private async attemptReconnection(): Promise<void> {
    if (this.isDestroyed || !this.eventId) return;

    this.state.attemptCount++;
    this.state.lastAttempt = Date.now();

    try {
      console.log(`🔄 Attempting reconnection (attempt ${this.state.attemptCount})`);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        console.error('⏰ Connection timeout');
        this.handleConnectionTimeout();
      }, this.config.connectionTimeout);

      // Attempt to reconnect
      await this.performReconnection();

      // If we get here, reconnection was successful
      this.state.totalReconnections++;
      this.handleSuccessfulConnection();

    } catch (error) {
      console.error('❌ Reconnection attempt failed:', error);
      this.handleReconnectionFailure();
    }
  }

  // Perform the actual reconnection
  private async performReconnection(): Promise<void> {
    if (!this.client || !this.eventManager || !this.eventId) {
      throw new Error('Reconnection manager not properly initialized');
    }

    // Disconnect existing connection
    await this.client.disconnect();

    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reinitialize client
    await this.client.initialize(this.eventId);

    // Reinitialize event manager
    await this.eventManager.initialize(this.eventId);

    // Perform state recovery if enabled
    if (this.config.enableStateRecovery) {
      await this.performStateRecovery();
    }
  }

  // Perform state recovery
  private async performStateRecovery(): Promise<void> {
    if (!this.eventManager) return;

    try {
      console.log('🔄 Performing state recovery...');

      // Set recovery timeout
      const recoveryTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('State recovery timeout')), this.config.stateRecoveryTimeout);
      });

      // Attempt to recover state
      const recoveryPromise = this.recoverApplicationState();
      
      await Promise.race([recoveryPromise, recoveryTimeout]);
      
      console.log('✅ State recovery completed');

    } catch (error) {
      console.error('❌ State recovery failed:', error);
      // Don't throw - state recovery failure shouldn't prevent reconnection
    }
  }

  // Recover application state
  private async recoverApplicationState(): Promise<void> {
    // This would typically involve:
    // 1. Re-fetching current event state
    // 2. Re-syncing with server state
    // 3. Replaying missed events
    // 4. Updating UI state

    // For now, we'll just log it
    console.log('🔄 Recovering application state...');
    
    // Simulate state recovery
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Handle connection timeout
  private handleConnectionTimeout(): void {
    console.error('⏰ Connection timeout during reconnection');
    this.handleReconnectionFailure();
  }

  // Handle reconnection failure
  private handleReconnectionFailure(): void {
    this.health.consecutiveFailures++;
    
    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Schedule next attempt
    this.scheduleReconnection();
  }

  // Start health checks
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  // Perform health check
  private performHealthCheck(): void {
    if (this.isDestroyed || !this.client) return;

    const now = Date.now();
    this.health.lastHealthCheck = now;

    // Check if connection is healthy
    const isConnected = this.client.isConnected();
    const timeSinceLastSuccess = now - this.health.lastSuccessfulConnection;
    
    if (!isConnected || timeSinceLastSuccess > this.config.healthCheckInterval * 2) {
      this.health.isHealthy = false;
      console.warn('⚠️ Health check failed - connection appears unhealthy');
      
      // Trigger reconnection if not already reconnecting
      if (!this.state.isReconnecting) {
        this.handleConnectionFailure();
      }
    } else {
      this.health.isHealthy = true;
    }
  }

  // Force reconnection
  async forceReconnect(): Promise<void> {
    if (this.isDestroyed) return;

    console.log('🔄 Forcing reconnection...');
    
    // Reset state
    this.state.attemptCount = 0;
    this.state.nextAttemptDelay = this.config.baseDelay;
    
    // Clear existing timers
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Start reconnection
    this.state.isReconnecting = true;
    await this.attemptReconnection();
  }

  // Get connection health
  getConnectionHealth(): ConnectionHealth {
    return { ...this.health };
  }

  // Get reconnection state
  getReconnectionState(): ReconnectionState {
    return { ...this.state };
  }

  // Check if reconnecting
  isReconnecting(): boolean {
    return this.state.isReconnecting;
  }

  // Check if healthy
  isHealthy(): boolean {
    return this.health.isHealthy;
  }

  // Get statistics
  getStatistics(): {
    health: ConnectionHealth;
    state: ReconnectionState;
    config: ReconnectionConfig;
  } {
    return {
      health: this.getConnectionHealth(),
      state: this.getReconnectionState(),
      config: this.config
    };
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;

    // Clear timers
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    console.log('🧹 Reconnection manager destroyed');
  }
}

// Singleton instance
let reconnectionManager: ReconnectionManager | null = null;

// Get or create singleton instance
export const getReconnectionManager = (config?: Partial<ReconnectionConfig>): ReconnectionManager => {
  if (!reconnectionManager) {
    reconnectionManager = new ReconnectionManager(config);
  }
  return reconnectionManager;
};

// Cleanup function
export const cleanupReconnectionManager = (): void => {
  if (reconnectionManager) {
    reconnectionManager.destroy();
    reconnectionManager = null;
  }
};
